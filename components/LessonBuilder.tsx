import React, { useState, useEffect, useRef } from 'react';
import { generateLessonPlan, generateSpeech, getLessonTopicSuggestions, improveLessonFormatting } from '../services/geminiService';
import { decodeAudioData } from '../services/audioUtils';
import { LessonPlanRequest, SchoolLevel, PedagogicalMethod, LessonObjective, SavedLesson } from '../types';
import { Loader2, FileText, Download, Play, Save, Check, ArrowLeft, StopCircle, Sparkles, Lightbulb, Wand2, Eye, Edit3, Grid, Image as ImageIcon, BookOpen } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../AuthContext';

const isTableSeparator = (line: string): boolean => {
    const cleanLine = line.trim();
    return /^\|?[\s\-:|]+\|?$/.test(cleanLine) && (cleanLine.match(/-/g) || []).length >= 3;
};

const cleanTextArtifacts = (text: string): string => {
    return text
        .replace(/<br\s*\/?>/gi, '') 
        .replace(/\$(.*?)\$/g, '$1'); 
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
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  useEffect(() => {
    if (initialLesson) {
      setFormData({
        subject: initialLesson.subject,
        level: initialLesson.level,
        grade: initialLesson.grade || GRADES_BY_LEVEL[initialLesson.level][0],
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
            grade: GRADES_BY_LEVEL[newLevel][0]
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
      setViewMode('preview');
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
      setViewMode('preview');
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
             const { error: updateError } = await supabase.from('lessons').update({
                content: result,
                last_modified: new Date().toISOString()
             }).eq('id', currentLessonId);
             error = updateError;
        } else {
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
             if (data) setCurrentLessonId(data.id);
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

  const markdownToHtml = (markdown: string) => {
    // Basic implementation for brevity in update, keep logic same as before but cleaner structure
    const lines = markdown.split('\n');
    let html = '';
    let inTable = false;
    let tableBuffer: string[] = [];
    let inList = false;

    const flushTable = (buffer: string[]) => {
       if (buffer.length < 2) return '';
       const rows = buffer.filter(row => !isTableSeparator(row));
       let tableHtml = '<table style="border-collapse: collapse; width: 100%; border: 1px solid #000; margin-bottom: 12px;">';
       rows.forEach((row, rowIndex) => {
          const content = row.trim().replace(/^\||\|$/g, '');
          const cells = content.split('|');
          tableHtml += '<tr>';
          cells.forEach(cell => {
             const style = 'border: 1px solid #000; padding: 5px;';
             let cellContent = cleanTextArtifacts(cell.trim()).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
             if (rowIndex === 0) tableHtml += `<th style="${style} background-color: #f0f0f0;"><strong>${cellContent}</strong></th>`;
             else tableHtml += `<td style="${style}">${cellContent}</td>`;
          });
          tableHtml += '</tr>';
       });
       tableHtml += '</table>';
       return tableHtml;
    };

    lines.forEach(line => {
      const trimmed = cleanTextArtifacts(line.trim());
      if (line.trim().startsWith('|')) { inTable = true; tableBuffer.push(line.trim()); return; }
      if (inTable) { html += flushTable(tableBuffer); tableBuffer = []; inTable = false; }
      if (trimmed.startsWith('> [SCHEMA]')) {
         const desc = trimmed.replace('> [SCHEMA]', '').trim();
         html += `<div style="border: 2px dashed #6366f1; background-color: #eef2ff; padding: 15px; margin: 10px 0; color: #4338ca;"><strong>🖼️ SCHÉMA REQUIS :</strong> ${desc}</div>`;
         return;
      }
      if (trimmed.startsWith('## ')) { html += `<h2 style="font-size: 16pt; color: #2E1065; text-transform: uppercase; margin-top: 20px;">${trimmed.substring(3)}</h2>`; return; }
      if (trimmed.startsWith('### ')) { html += `<h3 style="font-size: 14pt; color: #334155; margin-top: 15px;">${trimmed.substring(4)}</h3>`; return; }
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          if (!inList) { html += '<ul>'; inList = true; }
          const content = trimmed.substring(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
          html += `<li>${content}</li>`;
          return;
      }
      if (inList && !trimmed.startsWith('- ') && !trimmed.startsWith('* ')) { html += '</ul>'; inList = false; }
      if (trimmed === '') { html += '<br/>'; } 
      else {
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
      <head><meta charset='utf-8'><title>Fiche Pédagogique</title><style>body { font-family: 'Arial', sans-serif; font-size: 11pt; line-height: 1.5; color: #000000; }</style></head>
      <body>
        ${teacherHtml}
        <h1 style="text-align: center; color: #2E1065; font-size: 24pt;">${formData.subject || 'Fiche Pédagogique'}</h1>
        <p style="text-align: center;"><strong>Niveau:</strong> ${formData.level} - ${formData.grade || ''} | <strong>Durée:</strong> ${formData.duration} min</p>
        <hr/>
        ${html}
      </body></html>
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
      alert("La librairie PDF n'est pas encore chargée.");
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
    if (!element) { setDownloadingPdf(false); return; }
    const opt = {
      margin: [10, 10, 10, 10], 
      filename: `Cours_${(formData.subject || 'lesson').replace(/\s+/g, '_')}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    (window as any).html2pdf().set(opt).from(element).save().then(() => setDownloadingPdf(false));
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
      } else { setAudioPlaying(false); }
    } catch (e) { console.error("Audio error", e); setAudioPlaying(false); }
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

  const MarkdownPreview: React.FC<{ content: string }> = ({ content }) => {
    if (!content) return null;
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let tableBuffer: string[] = [];
    let inTable = false;

    const renderTable = (buffer: string[], keyPrefix: number) => {
         const rows = buffer.filter(row => !isTableSeparator(row));
         if (rows.length === 0) return null;
         return (
             <div key={`table-${keyPrefix}`} className="my-6 overflow-x-auto rounded-lg border border-[var(--border-color)]">
                 <table className="min-w-full text-sm">
                     <tbody>
                         {rows.map((row, rowIndex) => {
                             const content = row.trim().replace(/^\||\|$/g, '');
                             const cells = content.split('|');
                             const isHeader = rowIndex === 0;
                             return (
                                 <tr key={rowIndex} className={isHeader ? "bg-[var(--primary)]/10" : "hover:bg-[var(--primary)]/5"}>
                                     {cells.map((cell, cellIndex) => (
                                         <td key={cellIndex} className={`border-b border-[var(--border-color)] px-4 py-3 ${isHeader ? 'font-bold text-[var(--text-main)]' : 'text-[var(--text-main)]'} ${cellIndex < cells.length - 1 ? 'border-r' : ''}`}>
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
        line = cleanTextArtifacts(line);
        if (line.startsWith('|')) { tableBuffer.push(line); inTable = true; continue; } 
        else if (inTable) { elements.push(renderTable(tableBuffer, i)); tableBuffer = []; inTable = false; }

        if (line.startsWith('> [SCHEMA]')) {
             const description = line.replace('> [SCHEMA]', '').trim();
             elements.push(
                <div key={i} className="my-6 border border-dashed border-[var(--primary)] bg-[var(--primary)]/5 rounded-xl p-6 flex flex-col sm:flex-row gap-4 items-center text-center sm:text-left">
                    <div className="bg-white p-3 rounded-full shrink-0 shadow-sm text-[var(--primary)]">
                        <ImageIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <h4 className="font-bold text-[var(--primary)] text-sm uppercase tracking-wider mb-1">Illustration Suggérée</h4>
                        <p className="text-[var(--text-muted)] italic text-sm">{description}</p>
                    </div>
                </div>
             );
             continue;
        }

        if (line.startsWith('## ')) {
            elements.push(<h2 key={i} className="text-2xl font-bold uppercase text-[var(--primary)] mt-10 mb-4 border-b border-[var(--border-color)] pb-2">{line.replace(/^##\s+/, '')}</h2>);
            continue;
        }
        if (line.startsWith('### ')) {
            elements.push(<h3 key={i} className="text-xl font-bold text-[var(--text-main)] mt-6 mb-3">{line.replace(/^###\s+/, '')}</h3>);
            continue;
        }
        if (line.startsWith('- ') || line.startsWith('* ')) {
            const content = line.replace(/^[-*]\s+/, '');
            elements.push(
                <div key={i} className="flex gap-3 mb-2 ml-2">
                    <span className="text-[var(--primary)] font-bold mt-1.5">•</span>
                    <span className="leading-relaxed">
                        {content.split(/(\*\*.*?\*\*)/g).map((part, j) => {
                            if (part.startsWith('**') && part.endsWith('**')) return <strong key={j} className="font-semibold text-[var(--text-main)]">{part.slice(2, -2)}</strong>;
                            return <span key={j}>{part}</span>;
                        })}
                    </span>
                </div>
            );
            continue;
        }
        if (line === '') { elements.push(<br key={i} className="mb-2" />); continue; }

        elements.push(
            <p key={i} className="mb-3 text-justify text-[var(--text-main)] leading-relaxed">
                {line.split(/(\*\*.*?\*\*)/g).map((part, j) => {
                    if (part.startsWith('**') && part.endsWith('**')) return <strong key={j} className="font-semibold bg-[var(--primary)]/10 px-1 rounded text-[var(--text-main)]">{part.slice(2, -2)}</strong>;
                    return <span key={j}>{part}</span>;
                })}
            </p>
        );
    }
    if (inTable) elements.push(renderTable(tableBuffer, lines.length));

    return (
        <div id="lesson-content" className="prose max-w-none text-[var(--text-main)] p-8 sm:p-12 bg-white/80 rounded-xl shadow-sm border border-white/40 backdrop-blur-sm">
            {teacherInfo && (teacherInfo.name || teacherInfo.phone) && (
                <div className="mb-8 border-b-2 border-[var(--primary)] pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center text-[var(--text-main)]">
                    {teacherInfo.name && <h3 className="font-bold text-lg">{teacherInfo.name}</h3>}
                    {teacherInfo.phone && <p className="text-sm font-medium opacity-70">{teacherInfo.phone}</p>}
                </div>
            )}
            <div className="text-center mb-10 border-b border-[var(--border-color)] pb-8">
                <h1 className="text-3xl sm:text-4xl font-extrabold text-[var(--text-main)] mb-4 tracking-tight">{formData.subject}</h1>
                <div className="flex flex-wrap justify-center gap-3">
                    <span className="px-3 py-1 bg-[var(--primary)] text-white text-xs font-bold rounded-full uppercase">{formData.level}</span>
                    {formData.grade && <span className="px-3 py-1 bg-[var(--bg-main)] border border-[var(--border-color)] text-xs font-bold rounded-full uppercase">{formData.grade}</span>}
                    <span className="px-3 py-1 bg-[var(--bg-main)] border border-[var(--border-color)] text-xs font-bold rounded-full uppercase">{formatDuration(formData.duration)}</span>
                </div>
            </div>
            {elements}
        </div>
    );
  };

  if (result && isEditing) {
    return (
      <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="glass-panel p-3 rounded-2xl flex flex-col sm:flex-row items-center gap-4 sticky top-24 z-20 no-print overflow-x-auto scrollbar-hide backdrop-blur-xl">
            <button onClick={resetEditor} className="p-2.5 text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--bg-main)] rounded-xl transition-all flex-shrink-0"><ArrowLeft className="w-5 h-5" /></button>
            <div className="hidden sm:flex flex-col min-w-0 mr-auto ml-2">
                <h2 className="font-bold text-[var(--text-main)] truncate text-sm">Éditeur</h2>
            </div>
            <div className="flex bg-[var(--bg-main)] p-1 rounded-xl flex-shrink-0">
                <button onClick={() => setViewMode('preview')} className={`p-2 sm:px-4 sm:py-2 rounded-lg transition-all flex items-center gap-2 ${viewMode === 'preview' ? 'bg-white shadow-sm text-[var(--primary)] font-bold' : 'text-[var(--text-muted)]'}`}><Eye className="w-4 h-4" /><span className="hidden sm:inline text-xs">Aperçu</span></button>
                <button onClick={() => setViewMode('edit')} className={`p-2 sm:px-4 sm:py-2 rounded-lg transition-all flex items-center gap-2 ${viewMode === 'edit' ? 'bg-white shadow-sm text-[var(--primary)] font-bold' : 'text-[var(--text-muted)]'}`}><Edit3 className="w-4 h-4" /><span className="hidden sm:inline text-xs">Modifier</span></button>
            </div>
            <div className="h-6 w-px bg-[var(--border-color)] hidden sm:block"></div>
            <div className="flex items-center gap-2 flex-shrink-0">
                {viewMode === 'edit' && <button onClick={handleFormat} disabled={formatting} className="p-2 text-[var(--primary)] bg-[var(--primary)]/10 hover:bg-[var(--primary)]/20 rounded-lg transition-all">{formatting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}</button>}
                <button onClick={handleReadAloud} disabled={audioPlaying} className={`p-2 rounded-lg transition-all border ${audioPlaying ? 'bg-[var(--primary)] text-white border-transparent' : 'bg-transparent border-[var(--border-color)] hover:border-[var(--primary)] text-[var(--text-muted)]'}`}>{audioPlaying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}</button>
                <button onClick={handleExportPDF} disabled={downloadingPdf} className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-all"><FileText className="w-4 h-4" /></button>
                <button onClick={handleExportDocx} className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-all"><Download className="w-4 h-4" /></button>
                <button onClick={handleSave} className="px-4 py-2 text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] shadow-lg shadow-[var(--primary)]/30 rounded-lg transition-all flex items-center gap-2 font-bold text-sm"><Save className="w-4 h-4" /> Sauver</button>
            </div>
        </div>

        <div className="w-full">
             <div className="max-w-4xl mx-auto min-h-[800px] print:shadow-none print:min-h-0" ref={contentRef}>
                {viewMode === 'preview' ? (
                    <MarkdownPreview content={result} />
                ) : (
                    <div className="p-8 sm:p-12 h-full glass-panel rounded-xl min-h-[800px]">
                        <textarea 
                            className="w-full h-full min-h-[700px] text-[var(--text-main)] leading-loose outline-none resize-none font-mono text-sm border-none focus:ring-0 p-0 bg-transparent"
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
    <div className="max-w-2xl mx-auto glass-panel rounded-3xl p-8 sm:p-10 shadow-xl relative overflow-hidden">
      <div className="relative z-10">
        <div className="mb-8 text-center">
            <div className="w-16 h-16 bg-[var(--primary)] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[var(--primary)]/30 rotate-3">
                <BookOpen className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl font-extrabold text-[var(--text-main)] tracking-tight">Nouveau Cours</h2>
            <p className="text-[var(--text-muted)] mt-2 font-medium">Laissez l'IA structurer votre prochaine séance.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
            <div>
                <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider ml-1 mb-2 block">Sujet principal</label>
                <div className="flex gap-2">
                    <input
                        type="text"
                        name="subject"
                        required
                        value={formData.subject}
                        onChange={handleInputChange}
                        placeholder="Ex: La Révolution Française..."
                        className="flex-1 px-4 py-3.5 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl font-medium text-[var(--text-main)] focus:ring-2 focus:ring-[var(--primary)] outline-none transition-all placeholder:text-[var(--text-muted)]/50"
                    />
                    <button
                        type="button"
                        onClick={handleSuggestTopics}
                        disabled={loadingSuggestions}
                        className="px-4 bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20 rounded-xl hover:bg-[var(--primary)]/20 transition-all flex items-center justify-center"
                        title="Idées aléatoires"
                    >
                        {loadingSuggestions ? <Loader2 className="w-5 h-5 animate-spin" /> : <Lightbulb className="w-5 h-5" />}
                    </button>
                </div>
                {suggestions.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-2">
                        {suggestions.map((topic, idx) => (
                            <button key={idx} type="button" onClick={() => applySuggestion(topic)} className="text-xs font-medium bg-white/50 border border-[var(--border-color)] px-3 py-1.5 rounded-lg hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all text-[var(--text-muted)]">
                                {topic}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1">
                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider ml-1">Niveau</label>
                    <select name="level" value={formData.level} onChange={handleInputChange} className="w-full px-4 py-3 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl font-medium text-[var(--text-main)] focus:ring-2 focus:ring-[var(--primary)] outline-none appearance-none cursor-pointer hover:bg-[var(--bg-main)]/80">
                        {Object.values(SchoolLevel).map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider ml-1">Classe</label>
                    <select name="grade" value={formData.grade} onChange={handleInputChange} className="w-full px-4 py-3 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl font-medium text-[var(--text-main)] focus:ring-2 focus:ring-[var(--primary)] outline-none appearance-none cursor-pointer hover:bg-[var(--bg-main)]/80">
                        {GRADES_BY_LEVEL[formData.level].map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                 <div className="space-y-1">
                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider ml-1">Durée</label>
                    <select name="duration" value={formData.duration} onChange={handleInputChange} className="w-full px-4 py-3 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl font-medium text-[var(--text-main)] focus:ring-2 focus:ring-[var(--primary)] outline-none appearance-none cursor-pointer hover:bg-[var(--bg-main)]/80">
                        {[60, 90, 120].map(m => <option key={m} value={m}>{formatDuration(m)}</option>)}
                    </select>
                </div>
                <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider ml-1">Objectif</label>
                    <select name="objective" value={formData.objective} onChange={handleInputChange} className="w-full px-4 py-3 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl font-medium text-[var(--text-main)] focus:ring-2 focus:ring-[var(--primary)] outline-none appearance-none cursor-pointer hover:bg-[var(--bg-main)]/80">
                        {Object.values(LessonObjective).map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                </div>
            </div>

            <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 bg-gradient-to-r from-[var(--primary)] to-[var(--primary-hover)] text-white font-bold py-4 rounded-xl shadow-lg shadow-[var(--primary)]/30 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 text-lg disabled:opacity-70 disabled:cursor-not-allowed"
            >
            {loading ? <><Loader2 className="w-6 h-6 animate-spin" /> Conception...</> : <>Générer avec Gemini <Sparkles className="w-5 h-5 text-yellow-300" /></>}
            </button>
        </form>
      </div>
    </div>
  );
};

export default LessonBuilder;