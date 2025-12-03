import React from 'react';
import { X, Check, Sun, Moon, Cloud, Star, User, Phone } from 'lucide-react';
import { ThemeSettings, AccentColor, ThemeMode } from '../types';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ThemeSettings;
  onUpdateSettings: (newSettings: Partial<ThemeSettings>) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose, settings, onUpdateSettings }) => {
  if (!isOpen) return null;

  const colors: { id: AccentColor; name: string; hex: string }[] = [
    { id: 'ocean', name: 'Bleu Océan', hex: '#0ea5e9' }, // Sky/Cyan
    { id: 'purple', name: 'Violet', hex: '#8b5cf6' }, // Violet
    { id: 'green', name: 'Vert', hex: '#10b981' }, // Emerald
    { id: 'red', name: 'Rouge', hex: '#f43f5e' }, // Rose
    { id: 'gold', name: 'Doré', hex: '#f59e0b' }, // Amber
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-[var(--bg-card)] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-[var(--border-color)] max-h-[90vh] overflow-y-auto scrollbar-hide">
        
        <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between sticky top-0 bg-[var(--bg-card)] z-10">
          <h2 className="text-lg font-bold text-[var(--text-main)]">Paramètres</h2>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[var(--primary-light)] text-[var(--text-muted)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-8">

          {/* User Profile Section */}
          <div className="space-y-4">
             <h3 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-2">
                <User className="w-4 h-4" /> Profil Enseignant
             </h3>
             <div className="space-y-3">
                <div>
                    <label className="block text-sm font-medium text-[var(--text-main)] mb-1">Nom du Professeur</label>
                    <input 
                        type="text" 
                        value={settings.teacherName || ''}
                        onChange={(e) => onUpdateSettings({ teacherName: e.target.value })}
                        placeholder="Ex: M. Dupont"
                        className="w-full px-3 py-2 border border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-main)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] outline-none"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-[var(--text-main)] mb-1">Numéro de Téléphone</label>
                    <div className="relative">
                        <Phone className="absolute left-3 top-2.5 w-4 h-4 text-[var(--text-muted)]" />
                        <input 
                            type="tel" 
                            value={settings.teacherPhone || ''}
                            onChange={(e) => onUpdateSettings({ teacherPhone: e.target.value })}
                            placeholder="Ex: 01 23 45 67 89"
                            className="w-full pl-9 pr-3 py-2 border border-[var(--border-color)] bg-[var(--bg-main)] text-[var(--text-main)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] outline-none"
                        />
                    </div>
                </div>
             </div>
             <p className="text-xs text-[var(--text-muted)] italic">Ces informations apparaîtront en haut de vos fiches générées.</p>
          </div>

          <div className="h-px bg-[var(--border-color)] w-full"></div>
          
          {/* Theme Mode Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider">Thème Visuel</h3>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => onUpdateSettings({ mode: 'sky' })}
                className={`relative p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3 overflow-hidden group ${
                  settings.mode === 'sky' 
                  ? 'border-[var(--primary)] bg-[var(--primary-light)] ring-2 ring-[var(--primary)] ring-offset-2' 
                  : 'border-[var(--border-color)] hover:border-[var(--primary-light)]'
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-sky-200 to-white opacity-20"></div>
                <div className="bg-sky-100 p-2 rounded-full text-sky-600 z-10">
                  <Sun className="w-6 h-6" />
                </div>
                <span className="font-medium text-[var(--text-main)] z-10">Ciel Lumineux</span>
                {settings.mode === 'sky' && <div className="absolute top-2 right-2 text-[var(--primary)]"><Check className="w-4 h-4"/></div>}
              </button>

              <button
                onClick={() => onUpdateSettings({ mode: 'night' })}
                className={`relative p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3 overflow-hidden group ${
                  settings.mode === 'night' 
                  ? 'border-[var(--primary)] bg-slate-800 ring-2 ring-[var(--primary)] ring-offset-2' 
                  : 'border-[var(--border-color)] hover:border-[var(--primary-light)]'
                }`}
              >
                 <div className="absolute inset-0 bg-gradient-to-b from-slate-900 to-slate-800 opacity-90"></div>
                <div className="bg-indigo-900 p-2 rounded-full text-yellow-300 z-10">
                  <Star className="w-6 h-6 fill-current" />
                </div>
                <span className="font-medium text-white z-10">Nuit Étoilée</span>
                {settings.mode === 'night' && <div className="absolute top-2 right-2 text-[var(--primary)]"><Check className="w-4 h-4"/></div>}
              </button>
            </div>
          </div>

          {/* Accent Color Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider">Couleur d'accentuation</h3>
            <div className="flex flex-wrap gap-3 justify-center">
              {colors.map((color) => (
                <button
                  key={color.id}
                  onClick={() => onUpdateSettings({ color: color.id })}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-transform hover:scale-110 focus:outline-none ring-offset-2 ${
                    settings.color === color.id ? 'ring-2 ring-[var(--text-main)] scale-110' : ''
                  }`}
                  style={{ backgroundColor: color.hex }}
                  title={color.name}
                >
                  {settings.color === color.id && <Check className="w-6 h-6 text-white" />}
                </button>
              ))}
            </div>
          </div>

        </div>

        <div className="p-4 bg-[var(--bg-main)]/50 text-center text-xs text-[var(--text-muted)] border-t border-[var(--border-color)]">
          Personnalisez votre expérience pour plus de confort.
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;