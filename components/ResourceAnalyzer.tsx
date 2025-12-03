import React, { useState } from 'react';
import { analyzeImageResource } from '../services/geminiService';
import { Upload, Image as ImageIcon, Loader2 } from 'lucide-react';

// Formatter for Analysis Text
const FormattedAnalysis: React.FC<{ text: string }> = ({ text }) => {
  return (
    <div className="text-sm leading-relaxed space-y-3">
      {text.split('\n').map((line, i) => {
        const trimmed = line.trim();
        
        // Headers
        if (trimmed.startsWith('## ') || trimmed.startsWith('### ')) {
            return <h3 key={i} className="font-bold text-lg text-[var(--primary)] mt-4 mb-2">{trimmed.replace(/^#+\s/, '')}</h3>;
        }

        // Bullet points
        if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
           return (
            <div key={i} className="flex gap-2 ml-2">
                <span className="text-[var(--primary)] font-bold">•</span>
                <span>
                    {trimmed.replace(/^[\*\-]\s/, '').split(/(\*\*.*?\*\*)/g).map((part, j) => {
                         if (part.startsWith('**') && part.endsWith('**')) {
                            return <strong key={j} className="font-semibold">{part.slice(2, -2)}</strong>;
                        }
                        return <span key={j}>{part}</span>;
                    })}
                </span>
            </div>
           );
        }

        // Numbered lists (simple detection)
        if (/^\d+\.\s/.test(trimmed)) {
            return (
                <div key={i} className="flex gap-2 ml-2">
                    <span className="text-[var(--primary)] font-bold">{trimmed.match(/^\d+\./)?.[0]}</span>
                    <span>
                        {trimmed.replace(/^\d+\.\s/, '').split(/(\*\*.*?\*\*)/g).map((part, j) => {
                             if (part.startsWith('**') && part.endsWith('**')) {
                                return <strong key={j} className="font-semibold">{part.slice(2, -2)}</strong>;
                            }
                            return <span key={j}>{part}</span>;
                        })}
                    </span>
                </div>
            );
        }
        
        if (trimmed === '') return <br key={i} />;
        
        // Paragraphs
        return (
          <p key={i}>
            {line.split(/(\*\*.*?\*\*)/g).map((part, j) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={j} className="font-semibold text-[var(--text-main)]">{part.slice(2, -2)}</strong>;
              }
              return <span key={j}>{part}</span>;
            })}
          </p>
        );
      })}
    </div>
  );
};

const ResourceAnalyzer: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setAnalysis(null);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;

    setLoading(true);
    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
        const base64Data = base64String.split(',')[1];
        
        const result = await analyzeImageResource(
          base64Data,
          selectedFile.type,
          "Analyse cette ressource pédagogique (schéma, texte manuscrit ou photo). Décris ce que tu vois, identifie le sujet principal, et suggère 3 questions que je pourrais poser aux élèves à propos de cette image."
        );
        
        setAnalysis(result || "Impossible d'analyser l'image.");
        setLoading(false);
      };
      reader.readAsDataURL(selectedFile);
    } catch (error) {
      console.error(error);
      setAnalysis("Erreur lors de l'analyse.");
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* Upload Section */}
      <div className="bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border-color)] p-6">
        <h2 className="text-lg font-bold text-[var(--text-main)] mb-4 flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-[var(--primary)]" />
          Importer une ressource
        </h2>
        
        <div className="border-2 border-dashed border-[var(--border-color)] rounded-xl p-8 text-center hover:bg-[var(--bg-main)] transition-colors relative cursor-pointer group">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          {previewUrl ? (
            <img src={previewUrl} alt="Preview" className="max-h-64 mx-auto rounded-lg shadow-sm" />
          ) : (
            <div className="flex flex-col items-center text-[var(--text-muted)] group-hover:text-[var(--text-main)]">
              <Upload className="w-12 h-12 mb-3" />
              <p className="font-medium">Glissez une image ou cliquez pour importer</p>
              <p className="text-sm mt-1">Schémas, photos de manuel, notes...</p>
            </div>
          )}
        </div>

        <button
          onClick={handleAnalyze}
          disabled={!selectedFile || loading}
          className="w-full mt-6 bg-[var(--primary)] text-white font-medium py-2 px-4 rounded-lg hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {loading ? 'Analyse en cours...' : 'Analyser avec Gemini Pro'}
        </button>
      </div>

      {/* Result Section */}
      <div className="bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border-color)] p-6 flex flex-col">
        <h2 className="text-lg font-bold text-[var(--text-main)] mb-4">Analyse de l'IA</h2>
        
        <div className="flex-1 bg-[var(--bg-main)] rounded-lg p-4 overflow-y-auto border border-[var(--border-color)] min-h-[300px]">
          {analysis ? (
            <div className="prose prose-sm max-w-none text-[var(--text-main)]">
                <FormattedAnalysis text={analysis} />
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-[var(--text-muted)] italic text-sm">
              L'analyse apparaîtra ici après traitement.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResourceAnalyzer;