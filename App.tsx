import React, { useState, useEffect } from 'react';
import LessonBuilder from './components/LessonBuilder';
import SavedLessons from './components/SavedLessons';
import SettingsPanel from './components/SettingsPanel';
import Login from './components/Auth/Login';
import Signup from './components/Auth/Signup';
import { BookOpen, FolderOpen, Settings, LogOut, Sparkles } from 'lucide-react';
import { SavedLesson, ThemeSettings, AccentColor, ThemeMode } from './types';
import { useAuth } from './AuthContext';
import { supabase } from './supabaseClient';

enum Tab {
  GENERATOR = 'generator',
  SAVED = 'saved'
}

const App: React.FC = () => {
  const { user, loading, signOut } = useAuth();
  const [authView, setAuthView] = useState<'login' | 'signup'>('login');

  const [activeTab, setActiveTab] = useState<Tab>(Tab.GENERATOR);
  const [lessonToEdit, setLessonToEdit] = useState<SavedLesson | null>(null);
  const [refreshSavedList, setRefreshSavedList] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Theme State
  const [themeSettings, setThemeSettings] = useState<ThemeSettings>({
    color: 'ocean', // Default blue/ocean
    mode: 'sky',     // Default day
    teacherName: '',
    teacherPhone: ''
  });

  // Fetch Profile from Supabase on Login
  useEffect(() => {
    if (user) {
      const fetchProfile = async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (data && !error) {
          setThemeSettings({
            color: (data.theme_color as AccentColor) || 'ocean',
            mode: (data.theme_mode as ThemeMode) || 'sky',
            teacherName: data.teacher_name || '',
            teacherPhone: data.teacher_phone || ''
          });
        }
      };
      fetchProfile();
    }
  }, [user]);

  // Sync Settings to Supabase whenever they change
  const handleUpdateSettings = async (newSettings: Partial<ThemeSettings>) => {
    const updated = { ...themeSettings, ...newSettings };
    setThemeSettings(updated);

    if (user) {
      // Debounce update or just fire and forget for UI responsiveness
      await supabase.from('profiles').upsert({
        id: user.id,
        teacher_name: updated.teacherName,
        teacher_phone: updated.teacherPhone,
        theme_color: updated.color,
        theme_mode: updated.mode,
        updated_at: new Date().toISOString()
      });
    }
  };

  // Apply CSS Variables based on Theme Settings
  useEffect(() => {
    const root = document.documentElement;
    const { color, mode } = themeSettings;

    // 1. Apply Colors
    const colors: Record<AccentColor, { main: string, hover: string, light: string, text: string }> = {
      ocean:  { main: '#0ea5e9', hover: '#0284c7', light: '#e0f2fe', text: '#0369a1' },
      purple: { main: '#8b5cf6', hover: '#7c3aed', light: '#f3e8ff', text: '#6d28d9' },
      green:  { main: '#10b981', hover: '#059669', light: '#d1fae5', text: '#047857' },
      red:    { main: '#f43f5e', hover: '#e11d48', light: '#ffe4e6', text: '#be123c' },
      gold:   { main: '#f59e0b', hover: '#d97706', light: '#fef3c7', text: '#b45309' },
    };

    const selectedColor = colors[color];
    root.style.setProperty('--primary', selectedColor.main);
    root.style.setProperty('--primary-hover', selectedColor.hover);
    root.style.setProperty('--primary-light', selectedColor.light);
    root.style.setProperty('--primary-text', selectedColor.text);

    // 2. Apply Mode (Glass Variables)
    if (mode === 'night') {
      root.style.setProperty('--bg-card', 'rgba(15, 23, 42, 0.6)'); // Dark Glass
      root.style.setProperty('--bg-glass-border', 'rgba(255, 255, 255, 0.1)');
      root.style.setProperty('--text-main', '#f8fafc'); 
      root.style.setProperty('--text-muted', '#cbd5e1'); 
      root.style.setProperty('--border-color', 'rgba(255, 255, 255, 0.1)');
    } else {
      root.style.setProperty('--bg-card', 'rgba(255, 255, 255, 0.75)'); // Light Glass
      root.style.setProperty('--bg-glass-border', 'rgba(255, 255, 255, 0.6)');
      root.style.setProperty('--text-main', '#1e293b'); 
      root.style.setProperty('--text-muted', '#64748b'); 
      root.style.setProperty('--border-color', 'rgba(226, 232, 240, 0.8)');
    }

  }, [themeSettings]);

  const handleEditLesson = (lesson: SavedLesson) => {
    setLessonToEdit(lesson);
    setActiveTab(Tab.GENERATOR);
  };

  const handleLessonSaved = () => {
     setRefreshSavedList(prev => prev + 1);
  };

  const handleClearSelection = () => {
    setLessonToEdit(null);
  };

  // Generate stars for Night Mode
  const renderStars = () => {
    const stars = [];
    for (let i = 0; i < 70; i++) {
      const style = {
        top: `${Math.random() * 100}%`,
        left: `${Math.random() * 100}%`,
        width: `${Math.random() * 2 + 1}px`,
        height: `${Math.random() * 2 + 1}px`,
        animationDelay: `${Math.random() * 5}s`,
        animationDuration: `${Math.random() * 3 + 2}s`
      };
      stars.push(<div key={i} className="star" style={style}></div>);
    }
    return stars;
  };

  // AUTH LOADING STATE
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium animate-pulse">Chargement...</p>
        </div>
      </div>
    );
  }

  // LOGIN / SIGNUP VIEW
  if (!user) {
    return (
       <div className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden bg-slate-900">
          <div className="absolute inset-0 w-full h-full">
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-purple-600/30 blur-[100px] animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/30 blur-[100px] animate-pulse delay-700"></div>
          </div>

          <div className="z-10 w-full max-w-md animate-in fade-in zoom-in-95 duration-500">
             {authView === 'login' 
               ? <Login onSwitchToSignup={() => setAuthView('signup')} /> 
               : <Signup onSwitchToLogin={() => setAuthView('login')} />
             }
          </div>
       </div>
    );
  }

  // MAIN APP VIEW
  return (
    <div className="min-h-screen flex flex-col font-sans relative">
      
      {/* Backgrounds */}
      {themeSettings.mode === 'sky' && (
        <div className="theme-sky-bg">
           <div className="sun-glow"></div>
           <div className="cloud c1"></div>
           <div className="cloud c2"></div>
           <div className="cloud c3"></div>
           <div className="cloud c4"></div>
        </div>
      )}
      {themeSettings.mode === 'night' && (
        <div className="theme-night-bg">
          <div className="nebula n1"></div>
          <div className="nebula n2"></div>
          {renderStars()}
        </div>
      )}

      {/* Header */}
      <header className="glass-panel sticky top-4 z-30 mx-4 mt-4 rounded-2xl no-print transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-[var(--primary)] to-[var(--primary-hover)] p-2 rounded-xl shadow-lg shadow-[var(--primary)]/20 shrink-0">
              <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-[var(--text-main)] tracking-tight hidden sm:block">Assistant Pédagogique</h1>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="text-right mr-3 hidden sm:block">
               <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-muted)] opacity-70">Enseignant</p>
               <p className="text-sm font-bold text-[var(--text-main)]">{themeSettings.teacherName || user.email?.split('@')[0]}</p>
            </div>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2.5 rounded-xl hover:bg-[var(--primary-light)] text-[var(--text-muted)] hover:text-[var(--primary)] transition-all active:scale-95"
              title="Paramètres"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
               onClick={signOut}
               className="p-2.5 rounded-xl hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-500 transition-all active:scale-95"
               title="Déconnexion"
            >
               <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <SettingsPanel 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        settings={themeSettings}
        onUpdateSettings={handleUpdateSettings}
      />

      {/* Navigation */}
      <div className="sticky top-24 z-20 pt-6 pb-6 no-print">
        <div className="flex justify-center">
          <div className="glass-panel p-1.5 rounded-2xl flex space-x-1 shadow-lg">
            <button
              onClick={() => setActiveTab(Tab.GENERATOR)}
              className={`flex items-center gap-2 px-6 py-2.5 text-sm font-bold rounded-xl transition-all ${
                activeTab === Tab.GENERATOR
                  ? 'bg-[var(--primary)] text-white shadow-md'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--primary-light)]/50'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Générateur
            </button>

            <button
              onClick={() => setActiveTab(Tab.SAVED)}
              className={`flex items-center gap-2 px-6 py-2.5 text-sm font-bold rounded-xl transition-all ${
                activeTab === Tab.SAVED
                  ? 'bg-[var(--primary)] text-white shadow-md'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--primary-light)]/50'
              }`}
            >
              <FolderOpen className="w-4 h-4" />
              Mes Fiches
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 w-full">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {activeTab === Tab.GENERATOR && (
            <LessonBuilder 
               initialLesson={lessonToEdit} 
               onLessonSaved={handleLessonSaved}
               onClearSelection={handleClearSelection}
               teacherInfo={{ name: themeSettings.teacherName, phone: themeSettings.teacherPhone }}
            />
          )}
          {activeTab === Tab.SAVED && (
            <SavedLessons 
              onEdit={handleEditLesson} 
              refreshTrigger={refreshSavedList}
            />
          )}
        </div>
      </main>

      <footer className="glass-panel mt-auto py-6 no-print border-t border-[var(--border-color)]">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-[var(--text-muted)] text-sm font-medium">© 2024 Assistant Pédagogique IA</p>
        </div>
      </footer>
    </div>
  );
};

export default App;