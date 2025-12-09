import React, { useState, useEffect, useMemo } from 'react';
import { SavedLesson, SchoolLevel } from '../types';
import { Trash2, Edit2, Calendar, Book, GraduationCap, Loader2, Search, Filter, Layers, ChevronDown, SortAsc, SortDesc, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../AuthContext';

interface SavedLessonsProps {
  onEdit: (lesson: SavedLesson) => void;
  refreshTrigger?: number;
}

// Order of levels for sorting/display
const LEVEL_ORDER: SchoolLevel[] = [
  SchoolLevel.PRIMARY,
  SchoolLevel.MIDDLE_SCHOOL,
  SchoolLevel.HIGH_SCHOOL,
  SchoolLevel.UNIVERSITY,
  SchoolLevel.PROFESSIONAL
];

const SavedLessons: React.FC<SavedLessonsProps> = ({ onEdit, refreshTrigger }) => {
  const { user } = useAuth();
  const [lessons, setLessons] = useState<SavedLesson[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & Sort State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<SchoolLevel | 'ALL'>('ALL');
  const [selectedGrade, setSelectedGrade] = useState<string | 'ALL'>('ALL');
  const [sortOrder, setSortOrder] = useState<'DATE_DESC' | 'DATE_ASC' | 'ALPHA'>('DATE_DESC');

  useEffect(() => {
    const loadLessons = async () => {
      if (!user) return;
      setLoading(true);

      const { data, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('user_id', user.id)
        .order('last_modified', { ascending: false });

      if (error) {
        console.error("Error loading lessons:", error);
      } else if (data) {
        const mappedLessons: SavedLesson[] = data.map((item: any) => ({
          id: item.id,
          subject: item.subject,
          level: item.level,
          grade: item.grade,
          content: item.content,
          createdAt: new Date(item.created_at).getTime(),
          lastModified: new Date(item.last_modified).getTime()
        }));
        setLessons(mappedLessons);
      }
      setLoading(false);
    };
    loadLessons();
  }, [refreshTrigger, user]);

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

  // 1. Get available levels present in the data
  const availableLevels = useMemo(() => {
    const levels = new Set(lessons.map(l => l.level));
    // Return sorted by logical order
    return LEVEL_ORDER.filter(l => levels.has(l));
  }, [lessons]);

  // 2. Get available grades based on selected level
  const availableGrades = useMemo(() => {
    let filteredByLevel = lessons;
    if (selectedLevel !== 'ALL') {
      filteredByLevel = lessons.filter(l => l.level === selectedLevel);
    }
    const grades = Array.from(new Set(filteredByLevel.map(l => l.grade).filter(Boolean)));
    return grades.sort();
  }, [lessons, selectedLevel]);

  // 3. Filter and Sort the actual list
  const filteredLessons = useMemo(() => {
    return lessons.filter(l => {
      const matchesSearch = l.subject.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            l.content.toLowerCase().includes(searchQuery.toLowerCase());
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

  // 4. Group by Level for the "Overview" view
  const groupedLessons = useMemo(() => {
    if (selectedLevel !== 'ALL') return null; // Don't group if a specific level is filtered

    const groups: Record<string, SavedLesson[]> = {};
    filteredLessons.forEach(lesson => {
      if (!groups[lesson.level]) groups[lesson.level] = [];
      groups[lesson.level].push(lesson);
    });
    return groups;
  }, [filteredLessons, selectedLevel]);

  // --- Render Helpers ---

  const renderCard = (lesson: SavedLesson) => (
    <div 
      key={lesson.id}
      onClick={() => onEdit(lesson)}
      className="group bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border-color)] p-5 hover:shadow-md hover:border-[var(--primary)] transition-all cursor-pointer relative flex flex-col h-full animate-in fade-in zoom-in-95 duration-300"
    >
      <div className="flex justify-between items-start mb-3">
         <div className="flex flex-col gap-1">
            <span className="inline-flex w-fit items-center gap-1 px-2 py-0.5 bg-[var(--primary-light)] text-[var(--primary-text)] text-[10px] font-bold uppercase tracking-wider rounded-md">
              {lesson.level}
            </span>
            {lesson.grade && (
              <span className="text-xs font-semibold text-[var(--text-muted)]">
                {lesson.grade}
              </span>
            )}
         </div>
         <button 
            onClick={(e) => handleDelete(lesson.id, e)}
            className="p-1.5 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
            title="Supprimer"
         >
            <Trash2 className="w-4 h-4" />
         </button>
      </div>
      
      <h3 className="text-base font-bold text-[var(--text-main)] mb-2 line-clamp-2 leading-tight flex-grow">
        {lesson.subject}
      </h3>
      
      <div className="text-[var(--text-muted)] text-xs mb-4 line-clamp-3 font-serif leading-relaxed opacity-80">
         {lesson.content.slice(0, 120).replace(/[#*_]/g, '')}...
      </div>
      
      <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] mt-auto pt-3 border-t border-[var(--border-color)]">
         <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatDate(lesson.lastModified)}
         </div>
         <div className="flex items-center gap-1 text-[var(--primary)] font-medium opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0">
            <Edit2 className="w-3 h-3" />
            Modifier
         </div>
      </div>
    </div>
  );

  if (loading) {
    return (
       <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-[var(--primary)] animate-spin" />
       </div>
    );
  }

  if (lessons.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border-color)]">
        <div className="w-20 h-20 bg-[var(--bg-main)] rounded-full flex items-center justify-center mb-4">
          <Book className="w-10 h-10 text-[var(--text-muted)]" />
        </div>
        <h3 className="text-xl font-medium text-[var(--text-main)]">Aucune fiche enregistrée</h3>
        <p className="text-[var(--text-muted)] mt-2">Générez une fiche et cliquez sur "Enregistrer" pour la retrouver ici.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      
      {/* --- Toolbar --- */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-4 shadow-sm sticky top-0 z-10">
        <div className="flex flex-col md:flex-row gap-4 justify-between">
          
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Rechercher un sujet..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-main)] focus:ring-2 focus:ring-[var(--primary)] outline-none"
            />
          </div>

          {/* Filters Group */}
          <div className="flex flex-wrap gap-2 items-center">
            
            {/* Level Filter */}
            <div className="relative">
              <select
                value={selectedLevel}
                onChange={(e) => {
                    setSelectedLevel(e.target.value as SchoolLevel | 'ALL');
                    setSelectedGrade('ALL'); // Reset grade when level changes
                }}
                className="appearance-none pl-9 pr-8 py-2 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-main)] focus:ring-2 focus:ring-[var(--primary)] outline-none cursor-pointer hover:bg-[var(--bg-card)]"
              >
                <option value="ALL">Tous les cycles</option>
                {availableLevels.map(level => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
              <Layers className="absolute left-3 top-2.5 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
              <ChevronDown className="absolute right-3 top-3 w-3 h-3 text-[var(--text-muted)] pointer-events-none" />
            </div>

            {/* Grade Filter (Only show if filtering by level or if grades exist) */}
            <div className="relative">
               <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                disabled={availableGrades.length === 0}
                className="appearance-none pl-9 pr-8 py-2 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-main)] focus:ring-2 focus:ring-[var(--primary)] outline-none cursor-pointer hover:bg-[var(--bg-card)] disabled:opacity-50"
              >
                <option value="ALL">Toutes les classes</option>
                {availableGrades.map(grade => (
                  <option key={grade} value={grade}>{grade}</option>
                ))}
              </select>
              <GraduationCap className="absolute left-3 top-2.5 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
              <ChevronDown className="absolute right-3 top-3 w-3 h-3 text-[var(--text-muted)] pointer-events-none" />
            </div>

            {/* Sort Order */}
            <button
               onClick={() => setSortOrder(prev => prev === 'DATE_DESC' ? 'ALPHA' : (prev === 'ALPHA' ? 'DATE_DESC' : 'DATE_DESC'))}
               className="p-2 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors"
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
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Réinitialiser"
                 >
                     <X className="w-4 h-4" />
                 </button>
            )}
          </div>
        </div>
        
        <div className="mt-2 text-xs text-[var(--text-muted)] font-medium">
            {filteredLessons.length} fiche{filteredLessons.length > 1 ? 's' : ''} trouvée{filteredLessons.length > 1 ? 's' : ''}
        </div>
      </div>

      {/* --- Content Area --- */}

      {filteredLessons.length === 0 && (
         <div className="text-center py-12 opacity-60">
            <Search className="w-12 h-12 mx-auto text-[var(--text-muted)] mb-3" />
            <p className="text-[var(--text-main)]">Aucun résultat ne correspond à vos filtres.</p>
         </div>
      )}

      {/* View Mode 1: Grouped by Level (when no specific level filter is active) */}
      {groupedLessons ? (
        <div className="space-y-10">
          {LEVEL_ORDER.map(level => {
             const levelLessons = groupedLessons[level];
             if (!levelLessons || levelLessons.length === 0) return null;
             
             return (
               <div key={level} className="space-y-4">
                  <div className="flex items-center gap-3 border-b border-[var(--border-color)] pb-2">
                     <h2 className="text-xl font-bold text-[var(--primary)]">{level}</h2>
                     <span className="bg-[var(--bg-card)] border border-[var(--border-color)] px-2 py-0.5 rounded-full text-xs font-semibold text-[var(--text-muted)]">
                        {levelLessons.length}
                     </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                     {levelLessons.map(lesson => renderCard(lesson))}
                  </div>
               </div>
             );
          })}
        </div>
      ) : (
        /* View Mode 2: Flat Grid (when filtered) */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredLessons.map(lesson => renderCard(lesson))}
        </div>
      )}
    </div>
  );
};

export default SavedLessons;