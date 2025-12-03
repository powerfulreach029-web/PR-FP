import React, { useState, useEffect, useRef } from 'react';
import { generateLessonPlan, generateSpeech, getLessonTopicSuggestions, improveLessonFormatting } from '../services/geminiService';
import { decodeAudioData } from '../services/audioUtils';
import { LessonPlanRequest, SchoolLevel, PedagogicalMethod, LessonObjective, SavedLesson } from '../types';
import { Loader2, FileText, Download, Play, Save, Check, ArrowLeft, StopCircle, Sparkles, Lightbulb, Wand2, Eye, Edit3, Grid, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../AuthContext';

// Helper to check if a line is a table separator (e.g., |---|---| or | :--- |)
const isTableSeparator = (line: string): boolean => {
    const cleanLine = line.trim();
    // Must contain |, -, and optionally : or spaces
    // And must have at least 3 dashes
    return /^\|?[\s\-:|]+\|?$/.test(cleanLine) && (cleanLine.match(/-/g) || []).length >= 3;
};

// Helper to clean raw text from unwanted AI artifacts
const cleanTextArtifacts = (text: string): string => {
    return text
        .replace(/<br\s*\/?>/gi, '') // Remove HTML break tags
        .replace(/\$(.*?)\$/g, '$1'); // Remove LaTeX delimiters (e.g., $E=mc^2$ -> E=mc^2)
};

const GRADES_BY_LEVEL: Record<SchoolLevel, string[]> = {
    [SchoolLevel.PRIMARY]: ['CP1', 'CP2', 'CE1', 'CE2', 'CM1', 'CM2'],
    [SchoolLevel.MIDDLE_SCHOOL]: ['6ème', '5ème', '4ème', '3ème'],
    [SchoolLevel.HIGH_SCHOOL]: ['Seconde', 'Première', 'Terminale'],
    [SchoolLevel.UNIVERSITY]: ['Licence 1', 'Licence 2', 'Licence 3', 'Master 1', 'Master 2', 'Doctorat'],
    [SchoolLevel.PROFESSIONAL]: ['Formation']
};

interface LessonBuilderProps {
  initialLesson?: SavedLesson | null;
  onLessonSaved?: () => void;
  onClearSelection?: () => void;
  teacherInfo?: { name?: string; phone?: string };
}

const LessonBuilder: React.FC<LessonBuilderProps> = ({ initialLesson, onLessonSaved, onClearSelection, teacherInfo }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState<LessonPlanRequest>({
    subject: '',
    level: SchoolLevel.PRIMARY,
    grade: GRADES_BY_LEVEL[SchoolLevel.PRIMARY][0],
    duration: 60,
    objective: LessonObjective.DISCOVERY,
    method: PedagogicalMethod.EXPOSITORY
  });

  const [loading, setLoading] = useState(false);
  const [formatting, setFormatting] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [viewMode, setViewMode] = useState<'preview' | 'edit'>('preview');
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Suggestion State
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Load initial lesson if provided
  useEffect(() => {
    if (initialLesson) {
      setFormData({
        subject: initialLesson.subject,
        level: initialLesson.level,
        grade: '', // If loading old data without grade, will default to empty, handled in render if needed or data migration
        duration: 60,
        objective: LessonObjective.DISCOVERY,
        method: PedagogicalMethod.EXPOSITORY
      });
      setResult(initialLesson.content);
      setCurrentLessonId(initialLesson.id);
      setIsEditing(true);
      setViewMode('preview');
    }
  }, [initialLesson]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name === 'level') {
        const newLevel = value as SchoolLevel;
        setFormData(prev => ({
            ...prev,
            level: newLevel,
            grade: GRADES_BY_LEVEL[newLevel][0] // Reset grade to first of new level
        }));
    } else {
        setFormData(prev => ({
          ...prev,
          [name]: name === 'duration' ? parseInt(value) : value
        }));
    }

    if (name === 'subject' && suggestions.length > 0) {
        setSuggestions([]);
    }
  };

  const handleSuggestTopics = async () => {
    setLoadingSuggestions(true);
    try {
        const topics = await getLessonTopicSuggestions(formData.level);
        setSuggestions(topics);
    } catch (e) {
        console.error(e);
    } finally {
        setLoadingSuggestions(false);
    }
  };

  const applySuggestion = (topic: string) => {
      setFormData(prev => ({ ...prev, subject: topic }));
      setSuggestions([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setCurrentLessonId(null);
    try {
      const generatedPlan = await generateLessonPlan(formData);
      setResult(generatedPlan);
      setIsEditing(true);
      setViewMode('preview'); // Default to preview to show formatting
    } catch (error) {
      console.error(error);
      alert("Erreur lors de la génération");
    } finally {
      setLoading(false);
    }
  };

  const handleFormat = async () => {
    if (!result) return;
    setFormatting(true);
    try {
      const formattedContent = await improveLessonFormatting(result);
      setResult(formattedContent);
      setViewMode('preview'); // Switch to preview to show the result
    } catch (e) {
      console.error(e);
      alert("Erreur lors de la mise en forme");
    } finally {
      setFormatting(false);
    }
  };

  const handleSave = async () => {
    if (!result || !user) return;

    try {
        let error;
        if (currentLessonId) {
            // Update
             const { error: updateError } = await supabase.from('lessons').update({
                content: result,
                last_modified: new Date().toISOString()
             }).eq('id', currentLessonId);
             error = updateError;
        } else {
             // Create
             const { data, error: insertError } = await supabase.from('lessons').insert({
                 user_id: user.id,
                 subject: formData.subject || 'Cours sans titre',
                 level: formData.level,
                 grade: formData.grade,
                 duration: formData.duration,
                 objective: formData.objective,
                 method: formData.method,
                 content: result
             }).select().single();
             
             if (data) {
                 setCurrentLessonId(data.id);
             }
             error = insertError;
        }

        if (error) throw error;
        
        if (onLessonSaved) onLessonSaved();
        alert("Fiche enregistrée avec succès !");

    } catch (err: any) {
        console.error("Save error", err);
        alert("Erreur lors de la sauvegarde : " + err.message);
    }
  };

  // Advanced Markdown to HTML Parser for Word Export
  const markdownToHtml = (markdown: string) => {
    const lines = markdown.split('\n');
    let html = '';
    let inTable = false;
    let tableBuffer: string[] = [];
    let inList = false;

    const flushTable = (buffer: string[]) => {
       if (buffer.length < 2) return '';
       
       // Filter out separator rows
       const rows = buffer.filter(row => !isTableSeparator(row));
       
       let tableHtml = '<table style="border-collapse: collapse; width: 100%; border: 1px solid #000; margin-bottom: 12px;">';
       
       rows.forEach((row, rowIndex) => {
          // Robust split: remove leading/trailing pipes then split
          const content = row.trim().replace(/^\||\|$/g, '');
          const cells = content.split('|');
          
          tableHtml += '<tr>';
          cells.forEach(cell => {
             const style = 'border: 1px solid #000; padding: 5px;';
             // Clean text in cells
             let cellContent = cleanTextArtifacts(cell.trim()).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
             
             if (rowIndex === 0) {
                tableHtml += `<th style="${style} background-color: #f0f0f0;"><strong>${cellContent}</strong></th>`;
             } else {
                tableHtml += `<td style="${style}">${cellContent}</td>`;
             }
          });
          tableHtml += '</tr>';
       });
       tableHtml += '</table>';
       return tableHtml;
    };

    lines.forEach(line => {
      // Clean up the line first
      const trimmed = cleanTextArtifacts(line.trim());

      // Table handling (check original line structure for pipe)
      if (line.trim().startsWith('|')) {
         inTable = true;
         tableBuffer.push(line.trim()); // Push original logic, clean inside flush
         return;
      }
      if (inTable) {
         html += flushTable(tableBuffer);
         tableBuffer = [];
         inTable = false;
      }

      // Schema handling
      if (trimmed.startsWith('> [SCHEMA]')) {
         const desc = trimmed.replace('> [SCHEMA]', '').trim();
         html += `<div style="border: 2px dashed #6366f1; background-color: #eef2ff; padding: 15px; margin: 10px 0; color: #4338ca;"><strong>🖼️ SCHÉMA REQUIS :</strong> ${desc}</div>`;
         return;
      }

      // Headers
      if (trimmed.startsWith('## ')) {
         html += `<h2 style="font-size: 16pt; color: #2E1065; text-transform: uppercase; margin-top: 20px;">${trimmed.substring(3)}</h2>`;
         return;
      }
      if (trimmed.startsWith('### ')) {
         html += `<h3 style="font-size: 14pt; color: #334155; margin-top: 15px;">${trimmed.substring(4)}</h3>`;
         return;
      }

      // Lists
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          if (!inList) { html += '<ul>'; inList = true; }
          const content = trimmed.substring(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
          html += `<li>${content}</li>`;
          return;
      }
      if (inList && !trimmed.startsWith('- ') && !trimmed.startsWith('* ')) {
          html += '</ul>';
          inList = false;
      }

      // Paragraphs
      if (trimmed === '') {
          html += '<br/>';
      } else {
          const content = trimmed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
          html += `<p style="margin-bottom: 8px;">${content}</p>`;
      }
    });

    if (inTable) html += flushTable(tableBuffer);
    if (inList) html += '</ul>';

    const teacherHtml = teacherInfo && (teacherInfo.name || teacherInfo.phone) ? `
        <div style="border-bottom: 2px solid #2E1065; padding-bottom: 10px; margin-bottom: 20px;">
           ${teacherInfo.name ? `<p style="margin: 0; font-weight: bold; font-size: 12pt;">Enseignant : ${teacherInfo.name}</p>` : ''}
           ${teacherInfo.phone ? `<p style="margin: 0; font-size: 11pt;">Contact : ${teacherInfo.phone}</p>` : ''}
        </div>
    ` : '';

    return `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>Fiche Pédagogique</title>
        <style>
          body { font-family: 'Arial', sans-serif; font-size: 11pt; line-height: 1.5; color: #000000; }
        </style>
      </head>
      <body>
        ${teacherHtml}
        <h1 style="text-align: center; color: #2E1065; font-size: 24pt;">${formData.subject || 'Fiche Pédagogique'}</h1>
        <p style="text-align: center;"><strong>Niveau:</strong> ${formData.level} - ${formData.grade || ''} | <strong>Durée:</strong> ${formData.duration} min</p>
        <hr/>
        ${html}
      </body>
      </html>
    `;
  };

  const handleExportDocx = () => {
    if (!result) return;
    const htmlContent = markdownToHtml(result);
    const blob = new Blob(['\ufeff', htmlContent], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Cours_${(formData.subject || 'genere').replace(/\s+/g, '_')}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    if (!result) return;
    if (!(window as any).html2pdf) {
      alert("La librairie PDF n'est pas encore chargée. Veuillez patienter ou rafraîchir.");
      return;
    }

    setDownloadingPdf(true);
    if (viewMode === 'edit') {
      setViewMode('preview');
      setTimeout(() => generatePdf(), 100);
    } else {
      generatePdf();
    }
  };

  const generatePdf = () => {
    const element = document.getElementById('lesson-content');
    if (!element) {
      setDownloadingPdf(false);
      return;
    }

    const opt = {
      margin:       [10, 10, 10, 10], 
      filename:     `Cours_${(formData.subject || 'lesson').replace(/\s+/g, '_')}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, logging: false },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    const worker = (window as any).html2pdf().set(opt).from(element).save();
    worker.then(() => {
      setDownloadingPdf(false);
    }).catch((err: any) => {
      console.error(err);
      setDownloadingPdf(false);
      alert("Erreur lors de la création du PDF.");
    });
  };

  const handleReadAloud = async () => {
    if (!result || audioPlaying) return;
    setAudioPlaying(true);
    try {
      const audioDataBuffer = await generateSpeech(result);
      if (audioDataBuffer) {
         const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
         const uint8Data = new Uint8Array(audioDataBuffer);
         const buffer = await decodeAudioData(uint8Data, ctx, 24000);
         const source = ctx.createBufferSource();
         source.buffer = buffer;
         source.connect(ctx.destination);
         source.start(0);
         source.onended = () => setAudioPlaying(false);
      } else {
        setAudioPlaying(false);
      }
    } catch (e) {
      console.error("Audio playback error:", e);
      setAudioPlaying(false);
    }
  };

  const resetEditor = () => {
    setIsEditing(false);
    setResult(null);
    setCurrentLessonId(null);
    if (onClearSelection) onClearSelection();
  };

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h${m === 0 ? '00' : m}`;
  };

  const durationOptions = [60, 90, 120, 150, 180];

  // Advanced Markdown Renderer for Preview Mode (With Table and Schema support)
  const MarkdownPreview: React.FC<{ content: string }> = ({ content }) => {
    if (!content) return null;
    
    // Split lines
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let tableBuffer: string[] = [];
    let inTable = false;

    const renderTable = (buffer: string[], keyPrefix: number) => {
         // Filter out separators using the improved function
         const rows = buffer.filter(row => !isTableSeparator(row));
         if (rows.length === 0) return null;

         return (
             <div key={`table-${keyPrefix}`} className="my-6 overflow-x-auto">
                 <table className="min-w-full border-collapse border border-[var(--border-color)] text-sm">
                     <tbody>
                         {rows.map((row, rowIndex) => {
                             // Robust extraction logic
                             const content = row.trim().replace(/^\||\|$/g, '');
                             const cells = content.split('|');

                             const isHeader = rowIndex === 0;
                             return (
                                 <tr key={rowIndex} className={isHeader ? "bg-[var(--primary-light)]" : ""}>
                                     {cells.map((cell, cellIndex) => (
                                         <td key={cellIndex} className={`border border-[var(--border-color)] px-4 py-2 ${isHeader ? 'font-bold text-[var(--text-main)]' : 'text-[var(--text-muted)]'}`}>
                                              {cleanTextArtifacts(cell.trim()).replace(/\*\*(.*?)\*\*/g, '$1')} 
                                         </td>
                                     ))}
                                 </tr>
                             );
                         })}
                     </tbody>
                 </table>
             </div>
         );
    };

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        
        // PRE-CLEANING artifacts
        line = cleanTextArtifacts(line);

        // TABLE DETECTION
        if (line.startsWith('|')) {
            tableBuffer.push(line);
            inTable = true;
            continue;
        } else if (inTable) {
            // End of table, render it
            elements.push(renderTable(tableBuffer, i));
            tableBuffer = [];
            inTable = false;
        }

        // SCHEMA DETECTION
        if (line.startsWith('> [SCHEMA]')) {
             const description = line.replace('> [SCHEMA]', '').trim();
             elements.push(
                <div key={i} className="my-6 border-2 border-dashed border-[var(--primary-light)] bg-[var(--primary-light)]/30 rounded-lg p-6 flex flex-col sm:flex-row gap-4 items-center text-center sm:text-left">
                    <div className="bg-[var(--primary-light)] p-3 rounded-full shrink-0">
                        <ImageIcon className="w-6 h-6 text-[var(--primary)]" />
                    </div>
                    <div>
                        <h4 className="font-bold text-[var(--primary)] text-sm uppercase tracking-wider mb-1">Illustration Suggérée</h4>
                        <p className="text-[var(--text-muted)] italic">{description}</p>
                    </div>
                </div>
             );
             continue;
        }

        // HEADERS H1/H2
        if (line.startsWith('## ')) {
            elements.push(<h2 key={i} className="text-2xl font-bold uppercase text-[var(--primary)] mt-8 mb-4 border-b border-[var(--border-color)] pb-2 break-after-avoid">{line.replace(/^##\s+/, '')}</h2>);
            continue;
        }
        
        // HEADERS H3
        if (line.startsWith('### ')) {
            elements.push(<h3 key={i} className="text-xl font-bold text-[var(--text-main)] mt-6 mb-3 break-after-avoid">{line.replace(/^###\s+/, '')}</h3>);
            continue;
        }
        
        // LISTS
        if (line.startsWith('- ') || line.startsWith('* ')) {
            const content = line.replace(/^[-*]\s+/, '');
            elements.push(
                <div key={i} className="flex gap-3 mb-2 ml-4">
                    <span className="text-[var(--primary)] font-bold">•</span>
                    <span>
                        {content.split(/(\*\*.*?\*\*)/g).map((part, j) => {
                            if (part.startsWith('**') && part.endsWith('**')) {
                                return <strong key={j} className="font-semibold text-[var(--text-main)]">{part.slice(2, -2)}</strong>;
                            }
                            return <span key={j}>{part}</span>;
                        })}
                    </span>
                </div>
            );
            continue;
        }

        // EMPTY LINES
        if (line === '') {
            elements.push(<br key={i} className="mb-2" />);
            continue;
        }

        // PARAGRAPHS
        elements.push(
            <p key={i} className="mb-3 text-justify text-[var(--text-main)]">
                {line.split(/(\*\*.*?\*\*)/g).map((part, j) => {
                    if (part.startsWith('**') && part.endsWith('**')) {
                        return <strong key={j} className="font-semibold bg-[var(--primary-light)] px-0.5 rounded text-[var(--text-main)]">{part.slice(2, -2)}</strong>;
                    }
                    return <span key={j}>{part}</span>;
                })}
            </p>
        );
    }
    
    // Flush remaining table if exists at end of file
    if (inTable) elements.push(renderTable(tableBuffer, lines.length));

    return (
        <div id="lesson-content" className="prose max-w-none text-[var(--text-main)] font-serif leading-relaxed p-4 sm:p-8 bg-[var(--bg-card)]">
            {/* Teacher Header Info */}
            {teacherInfo && (teacherInfo.name || teacherInfo.phone) && (
                <div className="mb-6 border-b-2 border-[var(--primary)] pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center text-[var(--text-main)]">
                    {teacherInfo.name && <h3 className="font-bold text-lg">{teacherInfo.name}</h3>}
                    {teacherInfo.phone && <p className="text-sm text-[var(--text-muted)]">{teacherInfo.phone}</p>}
                </div>
            )}

            <div className="text-center mb-8 border-b border-[var(--border-color)] pb-6">
                <h1 className="text-3xl font-bold text-[var(--text-main)] mb-2">{formData.subject}</h1>
                <div className="flex justify-center gap-4 text-sm text-[var(--text-muted)] uppercase tracking-wide font-semibold">
                    <span>{formData.level}</span>
                    {formData.grade && <span>• {formData.grade}</span>}
                    <span>•</span>
                    <span>{formatDuration(formData.duration)}</span>
                </div>
            </div>
            {elements}
        </div>
    );
  };

  if (result && isEditing) {
    return (
      <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Mobile Responsive Toolbar */}
        <div className="bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border-color)] p-2 sm:p-4 flex flex-row items-center gap-2 sm:gap-4 sticky top-16 sm:top-24 z-20 no-print overflow-x-auto scrollbar-hide">
            {/* Back Button */}
            <button 
                onClick={resetEditor} 
                className="p-2 text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary-light)] rounded-lg transition-colors flex-shrink-0"
                title="Retour"
            >
                <ArrowLeft className="w-5 h-5" />
            </button>
            
            {/* Title (Hidden on very small screens) */}
            <div className="hidden sm:flex flex-col min-w-0 mr-auto">
                <h2 className="font-semibold text-[var(--text-main)] truncate">
                    {currentLessonId ? "Modification" : "Nouvelle fiche"}
                </h2>
            </div>
            
            {/* View Toggle */}
            <div className="flex bg-[var(--bg-main)] p-1 rounded-lg flex-shrink-0">
                <button
                    onClick={() => setViewMode('preview')}
                    className={`p-2 sm:px-3 sm:py-1.5 rounded-md transition-all flex items-center gap-2 ${
                        viewMode === 'preview' ? 'bg-[var(--bg-card)] text-[var(--primary)] shadow-sm' : 'text-[var(--text-muted)]'
                    }`}
                    title="Aperçu"
                >
                    <Eye className="w-4 h-4" />
                    <span className="hidden sm:inline text-sm font-medium">Aperçu</span>
                </button>
                <button
                    onClick={() => setViewMode('edit')}
                    className={`p-2 sm:px-3 sm:py-1.5 rounded-md transition-all flex items-center gap-2 ${
                        viewMode === 'edit' ? 'bg-[var(--bg-card)] text-[var(--primary)] shadow-sm' : 'text-[var(--text-muted)]'
                    }`}
                    title="Éditer"
                >
                    <Edit3 className="w-4 h-4" />
                    <span className="hidden sm:inline text-sm font-medium">Éditer</span>
                </button>
            </div>

            {/* Actions Group */}
            <div className="flex items-center gap-2 flex-shrink-0">
                 {viewMode === 'edit' && (
                    <button 
                        onClick={handleFormat} 
                        disabled={formatting}
                        className="p-2 sm:px-3 sm:py-2 text-[var(--primary)] bg-[var(--primary-light)] border border-[var(--primary-light)] hover:opacity-80 rounded-lg transition-all"
                        title="Re-formater avec l'IA"
                    >
                        {formatting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                    </button>
                 )}

                <div className="h-6 w-px bg-[var(--border-color)] hidden sm:block"></div>

                <button 
                  onClick={handleReadAloud} 
                  disabled={audioPlaying} 
                  className={`p-2 sm:px-3 sm:py-2 rounded-lg transition-all border ${audioPlaying ? 'bg-[var(--primary-light)] text-[var(--primary)] border-[var(--primary-light)]' : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border-color)] hover:border-[var(--primary)]'}`}
                  title="Lecture vocale"
                >
                    {audioPlaying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                </button>
                
                <button 
                    onClick={handleExportPDF}
                    disabled={downloadingPdf} 
                    className="p-2 sm:px-3 sm:py-2 text-red-700 bg-[var(--bg-card)] border border-red-100 hover:bg-red-50 rounded-lg transition-all"
                    title="Télécharger en PDF"
                >
                    {downloadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                </button>
                
                <button 
                    onClick={handleExportDocx} 
                    className="p-2 sm:px-3 sm:py-2 text-blue-700 bg-[var(--bg-card)] border border-blue-100 hover:bg-blue-50 rounded-lg transition-all"
                    title="Télécharger en Word"
                >
                    <Download className="w-4 h-4" /> 
                </button>
                
                <button 
                    onClick={handleSave} 
                    className="p-2 sm:px-4 sm:py-2 text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] shadow-sm rounded-lg transition-all flex items-center gap-2"
                    title="Enregistrer"
                >
                    <Save className="w-4 h-4" /> 
                    <span className="hidden sm:inline text-sm font-medium">Sauver</span>
                </button>
            </div>
        </div>

        {/* Editor / Preview Area */}
        <div className="bg-[var(--bg-main)] p-0 sm:p-4 rounded-xl print:bg-white print:p-0">
             <div className="bg-[var(--bg-card)] max-w-4xl mx-auto shadow-sm sm:shadow-md min-h-[800px] print:shadow-none print:min-h-0" ref={contentRef}>
                {viewMode === 'preview' ? (
                    <MarkdownPreview content={result} />
                ) : (
                    <div className="p-6 sm:p-12 h-full">
                        <textarea 
                            className="w-full h-full min-h-[800px] text-[var(--text-main)] leading-loose outline-none resize-none font-mono text-sm sm:text-base border-none focus:ring-0 p-0 bg-transparent"
                            value={result}
                            onChange={(e) => setResult(e.target.value)}
                            spellCheck={false}
                            placeholder="Le contenu généré apparaîtra ici..."
                        />
                    </div>
                )}
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border-color)] p-6 sm:p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[var(--text-main)]">Créer une fiche pédagogique</h2>
        <p className="text-[var(--text-muted)] mt-1">Remplissez les paramètres ci-dessous pour générer votre cours avec l'IA.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-[var(--text-main)] mb-1">Sujet du cours</label>
          <div className="flex gap-2">
            <input
                type="text"
                name="subject"
                required
                value={formData.subject}
                onChange={handleInputChange}
                placeholder="Ex: La Révolution Française, Théorème de Pythagore..."
                className="flex-1 px-4 py-3 border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-main)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] outline-none transition-all"
            />
            <button
                type="button"
                onClick={handleSuggestTopics}
                disabled={loadingSuggestions}
                className="px-4 py-3 bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary-light)] rounded-lg hover:opacity-80 transition-colors flex items-center justify-center gap-2 min-w-[50px] sm:min-w-auto"
                title="Suggérer des sujets"
            >
                {loadingSuggestions ? <Loader2 className="w-5 h-5 animate-spin" /> : <Lightbulb className="w-5 h-5" />}
                <span className="hidden sm:inline font-medium">Idées</span>
            </button>
          </div>
          
          {/* Suggestions Chips */}
          {suggestions.length > 0 && (
              <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  <p className="text-xs text-[var(--text-muted)] mb-2 font-medium">Suggestions pour {formData.level} :</p>
                  <div className="flex flex-wrap gap-2">
                      {suggestions.map((topic, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => applySuggestion(topic)}
                            className="text-xs bg-[var(--bg-main)] text-[var(--text-muted)] border border-[var(--border-color)] px-3 py-1.5 rounded-full hover:bg-[var(--primary-light)] hover:text-[var(--primary)] hover:border-[var(--primary)] transition-all active:scale-95"
                          >
                              {topic}
                          </button>
                      ))}
                  </div>
              </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-[var(--text-main)] mb-1">Niveau</label>
            <div className="relative">
                <select
                name="level"
                value={formData.level}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-main)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] outline-none appearance-none"
                >
                {Object.values(SchoolLevel).map(level => (
                    <option key={level} value={level}>{level}</option>
                ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[var(--text-muted)]">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                </div>
            </div>
          </div>

          <div>
             <label className="block text-sm font-medium text-[var(--text-main)] mb-1">Classe</label>
             <div className="relative">
                <select
                name="grade"
                value={formData.grade}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-main)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] outline-none appearance-none"
                >
                {GRADES_BY_LEVEL[formData.level].map(grade => (
                    <option key={grade} value={grade}>{grade}</option>
                ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[var(--text-muted)]">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-main)] mb-1">Durée</label>
            <div className="relative">
                <select
                name="duration"
                value={formData.duration}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-main)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] outline-none appearance-none"
                >
                {durationOptions.map(m => (
                    <option key={m} value={m}>{formatDuration(m)}</option>
                ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[var(--text-muted)]">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-[var(--text-main)] mb-1">Objectif</label>
            <div className="relative">
                <select
                name="objective"
                value={formData.objective}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-main)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] outline-none appearance-none"
                >
                {Object.values(LessonObjective).map(obj => (
                    <option key={obj} value={obj}>{obj}</option>
                ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[var(--text-muted)]">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-main)] mb-1">Méthode</label>
            <div className="relative">
                <select
                name="method"
                value={formData.method}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-main)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] outline-none appearance-none"
                >
                {Object.values(PedagogicalMethod).map(method => (
                    <option key={method} value={method}>{method}</option>
                ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[var(--text-muted)]">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                </div>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-8 bg-[var(--primary)] text-white font-bold py-4 px-6 rounded-xl hover:bg-[var(--primary-hover)] transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:translate-y-0"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Conception en cours...
            </>
          ) : (
            'Générer la Fiche'
          )}
        </button>
      </form>
    </div>
  );
};

export default LessonBuilder;