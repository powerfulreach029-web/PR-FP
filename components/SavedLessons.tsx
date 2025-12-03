import React, { useState, useEffect } from 'react';
import { SavedLesson } from '../types';
import { Trash2, Edit2, Calendar, Book, GraduationCap, Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../AuthContext';

interface SavedLessonsProps {
  onEdit: (lesson: SavedLesson) => void;
  refreshTrigger?: number; // Prop to force refresh when list changes
}

const SavedLessons: React.FC<SavedLessonsProps> = ({ onEdit, refreshTrigger }) => {
  const { user } = useAuth();
  const [lessons, setLessons] = useState<SavedLesson[]>([]);
  const [loading, setLoading] = useState(true);

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
        // Map snake_case DB fields to camelCase TS interface
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
      // Optimistic update
      setLessons(prev => prev.filter(l => l.id !== id));
      
      const { error } = await supabase
        .from('lessons')
        .delete()
        .eq('id', id);

      if (error) {
        console.error("Error deleting lesson", error);
        alert("Erreur lors de la suppression.");
        // Revert optimization would go here in robust app
      }
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {lessons.map((lesson) => (
        <div 
          key={lesson.id}
          onClick={() => onEdit(lesson)}
          className="group bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border-color)] p-6 hover:shadow-md hover:border-[var(--primary-light)] transition-all cursor-pointer relative"
        >
          <div className="flex justify-between items-start mb-4">
             <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[var(--primary-light)] text-[var(--primary-text)] text-xs font-semibold rounded-full">
                <GraduationCap className="w-3.5 h-3.5" />
                {lesson.level}
             </div>
             <button 
                onClick={(e) => handleDelete(lesson.id, e)}
                className="p-2 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                title="Supprimer"
             >
                <Trash2 className="w-4 h-4" />
             </button>
          </div>
          
          <h3 className="text-lg font-bold text-[var(--text-main)] mb-2 line-clamp-2 leading-tight">
            {lesson.subject}
          </h3>
          
          <div className="text-[var(--text-muted)] text-sm mb-6 line-clamp-3 font-serif">
             {lesson.content.slice(0, 150).replace(/[#*]/g, '')}...
          </div>
          
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mt-auto pt-4 border-t border-[var(--border-color)]">
             <div className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {formatDate(lesson.lastModified)}
             </div>
             <div className="flex items-center gap-1 text-[var(--primary)] font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                <Edit2 className="w-3.5 h-3.5" />
                Modifier
             </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SavedLessons;