import React, { useState, useEffect } from 'react';
import LessonBuilder from './components/LessonBuilder';
import LiveTutor from './components/LiveTutor';
import KnowledgeBase from './components/KnowledgeBase';
import ResourceAnalyzer from './components/ResourceAnalyzer';
import SavedLessons from './components/SavedLessons';
import SettingsPanel from './components/SettingsPanel';
import Login from './components/Auth/Login';
import Signup from './components/Auth/Signup';
import { BookOpen, Mic, MessageSquare, Image as ImageIcon, FolderOpen, Settings, LogOut, Sparkles } from 'lucide-react';
import { SavedLesson, ThemeSettings, AccentColor, ThemeMode } from './types';
import { useAuth } from './AuthContext';
import { supabase } from './supabaseClient';

enum Tab {
  GENERATOR = 'generator',
  LIVE = 'live',
  CHAT = 'chat',
  VISION = 'vision',
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
      ocean:  { main: '#0ea5e9', hover: '#0284c7', light: '#e0f2fe', text: '#0369a1' }, // Sky 500/600/100/700
      purple: { main: '#8b5cf6', hover: '#7c3aed', light: '#f3e8ff', text: '#6d28d9' }, // Violet
      green:  { main: '#10b981', hover: '#059669', light: '#d1fae5', text: '#047857' }, // Emerald
      red:    { main: '#f43f5e', hover: '#e11d48', light: '#ffe4e6', text: '#be123c' }, // Rose
      gold:   { main: '#f59e0b', hover: '#d97706', light: '#fef3c7', text: '#b45309' }, // Amber
    };

    const selectedColor = colors[color];
    root.style.setProperty('--primary', selectedColor.main);
    root.style.setProperty('--primary-hover', selectedColor.hover);
    root.style.setProperty('--primary-light', selectedColor.light);
    root.style.setProperty('--primary-text', selectedColor.text);

    // 2. Apply Mode (Bg/Text)
    if (mode === 'night') {
      root.style.setProperty('--bg-main', 'transparent'); // Handled by animation div
      root.style.setProperty('--bg-card', '#1e293b'); // Slate 800
      root.style.setProperty('--text-main', '#f8fafc'); // Slate 50
      root.style.setProperty('--text-muted', '#94a3b8'); // Slate 400
      root.style.setProperty('--border-color', '#334155'); // Slate 700
    } else {
      root.style.setProperty('--bg-main', 'transparent'); // Handled by animation div
      root.style.setProperty('--bg-card', '#ffffff');
      root.style.setProperty('--text-main', '#1e293b'); // Slate 800
      root.style.setProperty('--text-muted', '#64748b'); // Slate 500
      root.style.setProperty('--border-color', '#e2e8f0'); // Slate 200
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
    for (let i = 0; i < 50; i++) {
      const style = {
        top: `${Math.random() * 100}%`,
        left: `${Math.random() * 100}%`,
        width: `${Math.random() * 3 + 1}px`,
        height: `${Math.random() * 3 + 1}px`,
        animationDelay: `${Math.random() * 5}s`,
        opacity: Math.random()
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
          <p className="text-slate-500 font-medium animate-pulse">Chargement de l'assistant...</p>
        </div>
      </div>
    );
  }

  // LOGIN / SIGNUP VIEW
  if (!user) {
    return (
       <div className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden bg-slate-900">
          {/* Modern Animated Gradient Background */}
          <div className="absolute inset-0 w-full h-full">
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-purple-600/30 blur-[100px] animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/30 blur-[100px] animate-pulse delay-700"></div>
            <div className="absolute top-[20%] right-[20%] w-[30%] h-[30%] rounded-full bg-blue-500/20 blur-[80px] animate-pulse delay-1000"></div>
          </div>

          {/* Floating Shapes */}
          <div className="absolute top-10 left-10 text-white/10 animate-bounce delay-1000 duration-[3000ms]">
             <BookOpen className="w-24 h-24 rotate-12" />
          </div>
          <div className="absolute bottom-10 right-10 text-white/10 animate-bounce delay-500 duration-[4000ms]">
             <Sparkles className="w-32 h-32 -rotate-12" />
          </div>
          
          <div className="z-10 w-full max-w-md animate-in fade-in zoom-in-95 duration-500">
             {authView === 'login' 
               ? <Login onSwitchToSignup={() => setAuthView('signup')} /> 
               : <Signup onSwitchToLogin={() => setAuthView('login')} />
             }
          </div>
          
          <div className="absolute bottom-4 text-slate-500 text-xs text-center w-full z-10">
            © 2024 Assistant Pédagogique IA - Propulsé par Gemini 2.5
          </div>
       </div>
    );
  }

  // MAIN APP VIEW
  return (
    <div className="min-h-screen flex flex-col font-sans relative">
      
      {/* Dynamic Backgrounds */}
      {themeSettings.mode === 'sky' && (
        <div className="theme-sky-bg">
          <div className="sun"></div>
          <div className="cloud c1"></div>
          <div className="cloud c2"></div>
        </div>
      )}
      {themeSettings.mode === 'night' && (
        <div className="theme-night-bg">
          {renderStars()}
        </div>
      )}

      {/* Header */}
      <header className="bg-[var(--bg-card)] border-b border-[var(--border-color)] sticky top-0 z-20 no-print shadow-sm transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-[var(--primary)] p-2 rounded-lg shrink-0 transition-colors duration-300 shadow-md">
              <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-[var(--text-main)] tracking-tight truncate hidden sm:block">Assistant Pédagogique</h1>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="text-right mr-2 hidden sm:block">
               <p className="text-xs text-[var(--text-muted)]">Connecté en tant que</p>
               <p className="text-sm font-semibold text-[var(--text-main)]">{themeSettings.teacherName || user.email}</p>
            </div>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-full hover:bg-[var(--primary-light)] text-[var(--text-muted)] hover:text-[var(--primary)] transition-all"
              title="Paramètres"
            >
              <Settings className="w-6 h-6" />
            </button>
            <button
               onClick={signOut}
               className="p-2 rounded-full hover:bg-red-50 text-[var(--text-muted)] hover:text-red-500 transition-all"
               title="Déconnexion"
            >
               <LogOut className="w-6 h-6" />
            </button>
          </div>
        </div>
      </header>

      {/* Settings Panel Modal */}
      <SettingsPanel 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        settings={themeSettings}
        onUpdateSettings={handleUpdateSettings}
      />

      {/* Navigation Tabs - Horizontal Scroll on Mobile */}
      <div className="sticky top-16 z-10 bg-[var(--bg-card)]/80 backdrop-blur-sm pt-4 pb-4 border-b border-[var(--border-color)] sm:border-0 sm:static sm:bg-transparent sm:pt-8 sm:pb-6 no-print transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 overflow-x-auto scrollbar-hide">
          <div className="flex space-x-2 sm:space-x-1 min-w-max">
            <button
              onClick={() => setActiveTab(Tab.GENERATOR)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium rounded-full sm:rounded-lg transition-all border sm:border-transparent ${
                activeTab === Tab.GENERATOR
                  ? 'bg-[var(--primary)] text-white shadow-md transform scale-105'
                  : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border-color)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card)]'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Générateur
            </button>

            <button
              onClick={() => setActiveTab(Tab.SAVED)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium rounded-full sm:rounded-lg transition-all border sm:border-transparent ${
                activeTab === Tab.SAVED
                  ? 'bg-[var(--primary)] text-white shadow-md transform scale-105'
                  : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border-color)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card)]'
              }`}
            >
              <FolderOpen className="w-4 h-4" />
              Mes Fiches
            </button>
            
            <button
              onClick={() => setActiveTab(Tab.LIVE)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium rounded-full sm:rounded-lg transition-all border sm:border-transparent ${
                activeTab === Tab.LIVE
                  ? 'bg-[var(--primary)] text-white shadow-md transform scale-105'
                  : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border-color)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card)]'
              }`}
            >
              <Mic className="w-4 h-4" />
              Tuteur Vocal
            </button>

            <button
              onClick={() => setActiveTab(Tab.CHAT)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium rounded-full sm:rounded-lg transition-all border sm:border-transparent ${
                activeTab === Tab.CHAT
                  ? 'bg-[var(--primary)] text-white shadow-md transform scale-105'
                  : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border-color)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card)]'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Recherche
            </button>

            <button
              onClick={() => setActiveTab(Tab.VISION)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium rounded-full sm:rounded-lg transition-all border sm:border-transparent ${
                activeTab === Tab.VISION
                  ? 'bg-[var(--primary)] text-white shadow-md transform scale-105'
                  : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border-color)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card)]'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              Vision
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 w-full">
        <div className="animate-fade-in">
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
          {activeTab === Tab.LIVE && <LiveTutor />}
          {activeTab === Tab.CHAT && <KnowledgeBase />}
          {activeTab === Tab.VISION && <ResourceAnalyzer />}
        </div>
      </main>

      <footer className="bg-[var(--bg-card)]/90 border-t border-[var(--border-color)] py-8 mt-auto no-print backdrop-blur-sm transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 text-center text-[var(--text-muted)] text-sm">
          <p>© 2024 Assistant Pédagogique IA.</p>
        </div>
      </footer>
    </div>
  );
};

export default App;