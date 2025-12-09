import React, { useState, useRef, useEffect } from 'react';
import { chatWithSearch } from '../services/geminiService';
import { Send, Search, Bot, User, ExternalLink, Sparkles, Paperclip, X, File as FileIcon } from 'lucide-react';
import { ChatMessage } from '../types';

// Simple Markdown formatter component
const FormattedText: React.FC<{ text: string }> = ({ text }) => {
  // Split by code blocks or common patterns if needed, but here we focus on Bold and Lists
  const parts = text.split(/(\*\*.*?\*\*)/g);
  
  return (
    <div className="text-sm leading-relaxed space-y-2">
      {text.split('\n').map((line, i) => {
        // Handle Bullet points
        if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
           return (
            <div key={i} className="flex gap-2 ml-1">
                <span className="text-[var(--primary)] font-bold">•</span>
                <span>
                    {line.replace(/^[\*\-]\s/, '').split(/(\*\*.*?\*\*)/g).map((part, j) => {
                         if (part.startsWith('**') && part.endsWith('**')) {
                            return <strong key={j} className="font-semibold">{part.slice(2, -2)}</strong>;
                        }
                        return <span key={j}>{part}</span>;
                    })}
                </span>
            </div>
           );
        }
        
        // Handle Headings (simple h3 style)
        if (line.trim().startsWith('### ') || line.trim().startsWith('## ')) {
             return <h3 key={i} className="font-bold text-base mt-2 mb-1 text-[var(--text-main)]">{line.replace(/^#+\s/, '')}</h3>;
        }

        // Standard Paragraph with Bold support
        if (line.trim() === '') return <br key={i} />;
        
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

const KnowledgeBase: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', role: 'model', text: 'Bonjour ! Je suis votre assistant de recherche pédagogique. \n\nJe peux vous aider à :\n* Trouver des faits récents\n* Expliquer des concepts complexes\n* Analyser des fichiers (images, docs)\n* Suggérer des sources fiables' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{ file: File; preview: string; base64: string; mimeType: string } | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      
      reader.onloadend = () => {
        const base64String = reader.result as string;
        // Strip prefix for API usage
        const base64Data = base64String.split(',')[1];
        
        setSelectedFile({
            file,
            preview: base64String, // For display
            base64: base64Data,    // For API
            mimeType: file.type
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const clearFile = () => {
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !selectedFile) || loading) return;

    const attachmentData = selectedFile ? {
        mimeType: selectedFile.mimeType,
        data: selectedFile.base64
    } : undefined;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      attachment: attachmentData
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    clearFile();
    setLoading(true);

    try {
      // Prepare history for API
      // CRITICAL FIX: We must exclude the initial static welcome message (id: '1')
      // because Gemini API expects the conversation to start with a User message or System Instruction,
      // not a Model message.
      const history = messages
        .filter(m => m.id !== '1')
        .map(m => {
          const parts: any[] = [{ text: m.text }];
          // Note: In a real app, we might need to persist past attachments in history context.
          // For simplicity here, we only send text history + current attachment.
          return {
            role: m.role,
            parts: parts
          };
      });

      const response = await chatWithSearch(history, userMessage.text, attachmentData);
      
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "Pas de réponse.";
      
      // Extract grounding metadata if available
      let sources: { title: string; uri: string }[] = [];
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      
      if (groundingChunks) {
        sources = groundingChunks
          .map((chunk: any) => chunk.web)
          .filter((web: any) => web && web.uri && web.title);
      }

      const botMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: text,
        sources: sources.length > 0 ? sources : undefined
      };

      setMessages(prev => [...prev, botMessage]);

    } catch (error) {
      console.error("KnowledgeBase Error:", error);
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'model',
        text: "Désolé, une erreur est survenue lors de la recherche. Vérifiez votre connexion."
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border-color)] h-[calc(100vh-200px)] min-h-[500px] flex flex-col">
      <div className="p-4 border-b border-[var(--border-color)] bg-[var(--bg-main)]/50 flex items-center gap-2 rounded-t-xl">
        <div className="bg-[var(--bg-card)] p-1.5 rounded-lg shadow-sm border border-[var(--border-color)]">
            <Sparkles className="w-4 h-4 text-[var(--primary)]" />
        </div>
        <h2 className="font-semibold text-[var(--text-main)] text-sm sm:text-base">Recherche & Assistance</h2>
        <span className="ml-auto text-xs bg-[var(--primary-light)] text-[var(--primary-text)] px-2 py-0.5 rounded-full font-medium">Google Search + Vision</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm border ${msg.role === 'user' ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'bg-[var(--bg-main)] text-[var(--primary)] border-[var(--border-color)]'}`}>
              {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-5 h-5" />}
            </div>
            
            <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 shadow-sm ${msg.role === 'user' ? 'bg-[var(--primary)] text-white' : 'bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)]'}`}>
              
              {/* Render Attachment in History */}
              {msg.attachment && (
                  <div className="mb-3 rounded-lg overflow-hidden border border-white/20 bg-white/10 max-w-[200px]">
                      {msg.attachment.mimeType.startsWith('image/') ? (
                          <img src={`data:${msg.attachment.mimeType};base64,${msg.attachment.data}`} alt="Attachment" className="w-full h-auto" />
                      ) : (
                          <div className="flex items-center gap-2 p-3 text-sm">
                              <FileIcon className="w-4 h-4" />
                              <span className="truncate">Fichier joint</span>
                          </div>
                      )}
                  </div>
              )}

              {msg.role === 'user' ? (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.text}</p>
              ) : (
                  <FormattedText text={msg.text} />
              )}
              
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-2">Sources vérifiées</p>
                  <div className="flex flex-wrap gap-2">
                    {msg.sources.map((source, idx) => (
                      <a
                        key={idx}
                        href={source.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs bg-slate-50 text-slate-600 border border-slate-200 px-2.5 py-1.5 rounded-md hover:bg-slate-100 hover:text-indigo-600 hover:border-indigo-200 transition-all truncate max-w-[200px]"
                      >
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{source.title}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
            <div className="flex items-start gap-3">
                 <div className="w-8 h-8 rounded-full bg-[var(--bg-main)] text-[var(--primary)] flex items-center justify-center border border-[var(--border-color)]">
                    <Bot className="w-5 h-5" />
                 </div>
                 <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl p-4 shadow-sm flex gap-1">
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-75"></span>
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-150"></span>
                 </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 sm:p-4 border-t border-[var(--border-color)] bg-[var(--bg-card)] rounded-b-xl sticky bottom-0">
        
        {/* Attachment Preview Area */}
        {selectedFile && (
            <div className="flex items-center gap-3 p-2 mb-2 bg-[var(--bg-main)] rounded-lg border border-[var(--border-color)] w-fit max-w-full animate-in fade-in slide-in-from-bottom-2">
                <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 bg-white flex items-center justify-center border border-[var(--border-color)]">
                    {selectedFile.mimeType.startsWith('image/') ? (
                        <img src={selectedFile.preview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                        <FileIcon className="w-5 h-5 text-[var(--primary)]" />
                    )}
                </div>
                <div className="flex flex-col min-w-0 max-w-[150px]">
                    <span className="text-xs font-medium text-[var(--text-main)] truncate">{selectedFile.file.name}</span>
                    <span className="text-[10px] text-[var(--text-muted)]">{(selectedFile.file.size / 1024).toFixed(1)} KB</span>
                </div>
                <button 
                    onClick={clearFile}
                    className="p-1 hover:bg-red-50 text-[var(--text-muted)] hover:text-red-500 rounded-full transition-colors ml-1"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        )}

        <form onSubmit={handleSend} className="flex gap-2 items-end">
          {/* File Input */}
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden" 
            accept="image/*,application/pdf,text/plain" // Accept common formats
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-3 text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary-light)] rounded-xl transition-colors flex-shrink-0"
            title="Joindre un fichier"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
                if(e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e);
                }
            }}
            placeholder="Posez une question ou discutez du fichier..."
            className="flex-1 px-4 py-3 border border-[var(--border-color)] rounded-xl focus:ring-2 focus:ring-[var(--primary)] outline-none resize-none bg-[var(--bg-main)] focus:bg-[var(--bg-card)] text-[var(--text-main)] transition-colors max-h-[120px] min-h-[50px]"
            disabled={loading}
            rows={1}
          />
          <button
            type="submit"
            disabled={loading || (!input.trim() && !selectedFile)}
            className="bg-[var(--primary)] text-white p-3 rounded-xl hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50 shadow-md hover:shadow-lg flex-shrink-0"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default KnowledgeBase;