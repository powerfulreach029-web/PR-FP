import React, { useState, useEffect, useMemo } from 'react';
import { SavedLesson, SchoolLevel } from '../types';
import { Trash2, Edit2, Calendar, Book, GraduationCap, Loader2, Search, Filter, Layers, ChevronDown, SortAsc, SortDesc, X, Eye } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../AuthContext';

interface SavedLessonsProps {
  onEdit: (lesson: SavedLesson) => void;
  refreshTrigger?: number;
}

// Minimal structure for list view to save bandwidth
interface LessonSummary {
  id: string;
  subject: string;
  level: SchoolLevel;
  grade?: string;
  createdAt: number;
  lastModified: number;
  previewText?: string; // Optional preview snippet
}

const LEVEL_ORDER: SchoolLevel[] = [
  SchoolLevel.PRIMARY,
  SchoolLevel.MIDDLE_SCHOOL,
  SchoolLevel.HIGH_SCHOOL,
  SchoolLevel.UNIVERSITY,
  SchoolLevel.PROFESSIONAL
];

const SavedLessons: React.FC<SavedLessonsProps> = ({ onEdit, refreshTrigger }) => {
  const { user } = useAuth();
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingLessonId, setLoadingLessonId] = useState<string | null>(null);

  // Filter & Sort State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<SchoolLevel | 'ALL'>('ALL');
  const [selectedGrade, setSelectedGrade] = useState<string | 'ALL'>('ALL');
  const [sortOrder, setSortOrder] = useState<'DATE_DESC' | 'DATE_ASC' | 'ALPHA'>('DATE_DESC');

  useEffect(() => {
    const loadLessons = async () => {
      if (!user) return;
      setLoading(true);

      // PERFORMANCE OPTIMIZATION: 
      // Do NOT fetch the 'content' column (which is huge). Only fetch metadata.
      const { data, error } = await supabase
        .from('lessons')
        .select('id, subject, level, grade, created_at, last_modified')
        .eq('user_id', user.id)
        .order('last_modified', { ascending: false });

      if (error) {
        console.error("Error loading lessons:", error);
      } else if (data) {
        const mappedLessons: LessonSummary[] = data.map((item: any) => ({
          id: item.id,
          subject: item.subject,
          level: item.level,
          grade: item.grade,
          createdAt: new Date(item.created_at).getTime(),
          lastModified: new Date(item.last_modified).getTime()
        }));
        setLessons(mappedLessons);
      }
      setLoading(false);
    };
    loadLessons();
  }, [refreshTrigger, user]);

  const handleOpenLesson = async (summary: LessonSummary) => {
    setLoadingLessonId(summary.id);
    try {
        // Fetch full content on demand
        const { data, error } = await supabase
            .from('lessons')
            .select('*') // Now we fetch everything including content
            .eq('id', summary.id)
            .single();

        if (error || !data) throw error;

        const fullLesson: SavedLesson = {
            id: data.id,
            subject: data.subject,
            level: data.level,
            grade: data.grade,
            content: data.content,
            createdAt: new Date(data.created_at).getTime(),
            lastModified: new Date(data.last_modified).getTime()
        };

        onEdit(fullLesson);
    } catch (err) {
        console.error("Error fetching full lesson content", err);
        alert("Impossible de charger le contenu de la leçon.");
    } finally {
        setLoadingLessonId(null);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Voulez-vous vraiment supprimer cette fiche ?')) {
      setLessons(prev => prev.filter(l => l.id !== id));
      
      const { error } = await supabase
        .from('lessons')
        .delete()
        .eq('id', id);

      if (error) {
        console.error("Error deleting lesson", error);
        alert("Erreur lors de la suppression.");
      }
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // --- Derived State for Filtering ---
  const availableLevels = useMemo(() => {
    const levels = new Set(lessons.map(l => l.level));
    return LEVEL_ORDER.filter(l => levels.has(l));
  }, [lessons]);

  const availableGrades = useMemo(() => {
    let filteredByLevel = lessons;
    if (selectedLevel !== 'ALL') {
      filteredByLevel = lessons.filter(l => l.level === selectedLevel);
    }
    const grades = Array.from(new Set(filteredByLevel.map(l => l.grade).filter(Boolean)));
    return grades.sort();
  }, [lessons, selectedLevel]);

  const filteredLessons = useMemo(() => {
    return lessons.filter(l => {
      // Search only on Subject/Grade now since we don't have content
      const matchesSearch = l.subject.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesLevel = selectedLevel === 'ALL' || l.level === selectedLevel;
      const matchesGrade = selectedGrade === 'ALL' || l.grade === selectedGrade;
      return matchesSearch && matchesLevel && matchesGrade;
    }).sort((a, b) => {
      if (sortOrder === 'DATE_DESC') return b.lastModified - a.lastModified;
      if (sortOrder === 'DATE_ASC') return a.lastModified - b.lastModified;
      if (sortOrder === 'ALPHA') return a.subject.localeCompare(b.subject);
      return 0;
    });
  }, [lessons, searchQuery, selectedLevel, selectedGrade, sortOrder]);

  const groupedLessons = useMemo(() => {
    if (selectedLevel !== 'ALL') return null;
    const groups: Record<string, LessonSummary[]> = {};
    filteredLessons.forEach(lesson => {
      if (!groups[lesson.level]) groups[lesson.level] = [];
      groups[lesson.level].push(lesson);
    });
    return groups;
  }, [filteredLessons, selectedLevel]);

  // --- Render Card ---
  const renderCard = (lesson: LessonSummary) => (
    <div 
      key={lesson.id}
      onClick={() => handleOpenLesson(lesson)}
      className="group glass-panel rounded-2xl p-5 hover:border-[var(--primary)] transition-all cursor-pointer relative flex flex-col h-full animate-in fade-in zoom-in-95 duration-300 hover:-translate-y-1 hover:shadow-xl"
    >
      <div className="flex justify-between items-start mb-4">
         <div className="flex flex-col gap-1.5">
            <span className="inline-flex w-fit items-center gap-1.5 px-2.5 py-1 bg-[var(--primary)]/10 text-[var(--primary)] text-[10px] font-bold uppercase tracking-wider rounded-lg border border-[var(--primary)]/20">
              {lesson.level}
            </span>
            {lesson.grade && (
              <span className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1">
                 <GraduationCap className="w-3 h-3" /> {lesson.grade}
              </span>
            )}
         </div>
         <button 
            onClick={(e) => handleDelete(lesson.id, e)}
            className="p-2 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
            title="Supprimer"
         >
            <Trash2 className="w-4 h-4" />
         </button>
      </div>
      
      <h3 className="text-lg font-bold text-[var(--text-main)] mb-2 line-clamp-2 leading-tight flex-grow">
        {lesson.subject}
      </h3>
      
      <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] font-medium mt-auto pt-4 border-t border-[var(--border-color)]">
         <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {formatDate(lesson.lastModified)}
         </div>
         <div className="flex items-center gap-1.5 text-[var(--primary)] font-bold opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
            {loadingLessonId === lesson.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
                <>
                    <span className="uppercase tracking-wide text-[10px]">Ouvrir</span>
                    <Edit2 className="w-3.5 h-3.5" />
                </>
            )}
         </div>
      </div>
    </div>
  );

  if (loading) {
    return (
       <div className="flex justify-center py-20">
          <div className="glass-panel p-4 rounded-full">
             <Loader2 className="w-8 h-8 text-[var(--primary)] animate-spin" />
          </div>
       </div>
    );
  }

  if (lessons.length === 0) {
    return (
      <div className="glass-panel flex flex-col items-center justify-center py-20 rounded-2xl text-center px-4">
        <div className="w-24 h-24 bg-[var(--primary-light)]/50 rounded-full flex items-center justify-center mb-6 animate-pulse">
          <Book className="w-10 h-10 text-[var(--primary)]" />
        </div>
        <h3 className="text-2xl font-bold text-[var(--text-main)] mb-2">Aucune fiche enregistrée</h3>
        <p className="text-[var(--text-muted)] max-w-md">Générez votre premier cours avec l'IA et enregistrez-le pour le retrouver ici.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      
      {/* --- Toolbar --- */}
      <div className="glass-panel rounded-2xl p-4 sticky top-4 z-10 backdrop-blur-xl">
        <div className="flex flex-col md:flex-row gap-4 justify-between">
          
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Rechercher par titre..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl text-sm font-medium text-[var(--text-main)] focus:ring-2 focus:ring-[var(--primary)] outline-none transition-all placeholder:text-[var(--text-muted)]/70"
            />
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <select
                value={selectedLevel}
                onChange={(e) => {
                    setSelectedLevel(e.target.value as SchoolLevel | 'ALL');
                    setSelectedGrade('ALL');
                }}
                className="appearance-none pl-9 pr-8 py-2.5 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl text-sm font-medium text-[var(--text-main)] focus:ring-2 focus:ring-[var(--primary)] outline-none cursor-pointer hover:bg-[var(--bg-main)]/80 transition-all shadow-sm"
              >
                <option value="ALL">Tous les cycles</option>
                {availableLevels.map(level => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
              <Layers className="absolute left-3 top-2.5 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
              <ChevronDown className="absolute right-3 top-3 w-3 h-3 text-[var(--text-muted)] pointer-events-none" />
            </div>

            <div className="relative">
               <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                disabled={availableGrades.length === 0}
                className="appearance-none pl-9 pr-8 py-2.5 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl text-sm font-medium text-[var(--text-main)] focus:ring-2 focus:ring-[var(--primary)] outline-none cursor-pointer hover:bg-[var(--bg-main)]/80 transition-all shadow-sm disabled:opacity-50"
              >
                <option value="ALL">Toutes les classes</option>
                {availableGrades.map(grade => (
                  <option key={grade} value={grade}>{grade}</option>
                ))}
              </select>
              <GraduationCap className="absolute left-3 top-2.5 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
              <ChevronDown className="absolute right-3 top-3 w-3 h-3 text-[var(--text-muted)] pointer-events-none" />
            </div>

            <button
               onClick={() => setSortOrder(prev => prev === 'DATE_DESC' ? 'ALPHA' : 'DATE_DESC')}
               className="p-2.5 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl hover:bg-[var(--bg-main)]/80 text-[var(--text-muted)] hover:text-[var(--primary)] transition-all shadow-sm"
               title="Changer le tri"
            >
               {sortOrder === 'ALPHA' ? <SortAsc className="w-4 h-4" /> : <Calendar className="w-4 h-4" />}
            </button>
            
            {(selectedLevel !== 'ALL' || selectedGrade !== 'ALL' || searchQuery) && (
                 <button 
                    onClick={() => {
                        setSelectedLevel('ALL');
                        setSelectedGrade('ALL');
                        setSearchQuery('');
                    }}
                    className="p-2.5 text-red-500 bg-red-500/10 hover:bg-red-500/20 rounded-xl transition-all"
                    title="Réinitialiser"
                 >
                     <X className="w-4 h-4" />
                 </button>
            )}
          </div>
        </div>
      </div>

      {/* --- Content Area --- */}

      {filteredLessons.length === 0 && (
         <div className="text-center py-12 opacity-60 glass-panel rounded-2xl">
            <Search className="w-12 h-12 mx-auto text-[var(--text-muted)] mb-3" />
            <p className="text-[var(--text-main)] font-medium">Aucun résultat ne correspond à vos filtres.</p>
         </div>
      )}

      {groupedLessons ? (
        <div className="space-y-12">
          {LEVEL_ORDER.map(level => {
             const levelLessons = groupedLessons[level];
             if (!levelLessons || levelLessons.length === 0) return null;
             
             return (
               <div key={level} className="space-y-5">
                  <div className="flex items-center gap-3 border-b border-[var(--border-color)] pb-3">
                     <h2 className="text-xl font-bold text-[var(--text-main)]">{level}</h2>
                     <span className="bg-[var(--primary)]/10 text-[var(--primary)] px-2.5 py-0.5 rounded-full text-xs font-bold">
                        {levelLessons.length}
                     </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                     {levelLessons.map(lesson => renderCard(lesson))}
                  </div>
               </div>
             );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLessons.map(lesson => renderCard(lesson))}
        </div>
      )}
    </div>
  );
};

export default SavedLessons;