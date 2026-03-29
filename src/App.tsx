/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import {
  BookOpen,
  Sparkles,
  FileText,
  Settings,
  History,
  Plus,
  Send,
  Download,
  Printer,
  Share2,
  ChevronRight,
  BrainCircuit,
  Target,
  Users,
  Lightbulb,
  AlertCircle,
  CheckCircle2,
  Layers,
  Accessibility,
  Moon,
  Sun,
  Palette,
  School
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import html2canvas from 'html2canvas';
// @ts-ignore
import html2pdf from 'html2pdf.js';
import { auth, db, googleProvider } from './firebase';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User
} from 'firebase/auth';
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  getDoc,
  setDoc,
  orderBy,
  Timestamp,
  deleteDoc,
  doc
} from 'firebase/firestore';

// Constants
const LEVELS = [
  { id: 'preschool', name: 'Préscolaire', classes: ['Petite Section', 'Moyenne Section', 'Grande Section'] },
  { id: 'primary', name: 'Primaire', classes: ['CP', 'CE1', 'CE2', 'CM1', 'CM2'] },
  { id: 'middle', name: 'Collège', classes: ['6ème', '5ème', '4ème', '3ème'] },
  { id: 'high', name: 'Lycée', classes: ['2de', '1ère', 'Tle'] },
  { id: 'university', name: 'Université', classes: ['L1', 'L2', 'L3', 'M1', 'M2', 'Doctorat'] }
];

const SUBJECTS = [
  'Mathématiques', 'Français', 'Histoire-Géographie', 'SVT', 'Physique-Chimie',
  'Anglais', 'Espagnol', 'Allemand', 'EPS', 'Arts Plastiques', 'Éducation Musicale',
  'Philosophie', 'SES', 'Informatique'
];

const THEME_COLORS = [
  { id: 'green', name: 'Vert', class: 'emerald' },
  { id: 'yellow', name: 'Jaune', class: 'amber' },
  { id: 'red', name: 'Rouge', class: 'red' },
  { id: 'blue', name: 'Bleu', class: 'blue' },
  { id: 'purple', name: 'Violet', class: 'violet' },
  { id: 'pink', name: 'Rose', class: 'pink' }
];

// Types
interface TeacherInfo {
  name: string;
  school: string;
  specialty: string;
}

interface LessonPlan {
  id: string;
  title: string;
  lessonTitle?: string;
  sessionNumber?: string;
  totalSessions?: string;
  level: string;
  subject: string;
  duration: string;
  objectives: string[];
  socleCommun: string[];
  steps: {
    name: string;
    duration: string;
    teacherTask: string;
    studentTask: string;
  }[];
  inclusionSidebar: {
    ppre: string;
    pap: string;
    pps: string;
    pai: string;
  };
  reflexiveAnalysis: {
    prescritVsReel: string;
    heterogeneite: string;
    climatClasse: string;
  };
  traceEcrite: {
    complete: string;
    differenciee: string;
  };
  paretoDistillation: string[];
  timestamp: number;
}

const SYSTEM_INSTRUCTION = `Tu es un expert en didactique et ingénierie pédagogique, spécialisé dans l'Approche Par Compétences (APC) de l'Éducation Nationale française.
Ton rôle est d'aider les enseignants à concevoir des fiches de préparation (fiches pédagogiques) rigoureuses et innovantes.

Tu dois impérativement suivre ces principes :
1. Transition de la PPO à l'APC : Focalise-toi sur la mobilisation des ressources par l'élève pour résoudre des situations-problèmes.
2. Moteur des 7 Étapes (ma-methoda) :
   - Analyse des objectifs (Bloom révisé, SMART).
   - Stratégie pédagogique (Apprentissage actif).
   - Problématisation (Créer un gap cognitif : paradoxe, mise en tension, etc.).
   - Animation/Planification (Accroche, évaluation diagnostique).
   - Synthétisation (Proposer formats visuel, auditif, écrit).
   - Évaluation (Rôle authentique pour l'élève).
   - Rétroaction (Analyse réflexive).
3. Algorithme de Pareto (80/20) : Identifie les 20% de connaissances essentielles (Vocabulaire Pivot, Concepts Clés).
4. Socle Commun : Mappe les activités sur les 5 domaines (D1 à D5).
5. Inclusion & Différenciation : Génère systématiquement une "Inclusion Sidebar" (PPRE, PAP, PPS, PAI) et une version FALC si demandée.
6. Structure de Sortie :
   - En-tête : Identification, Cadre Didactique, Objectif opérationnel, Logistique.
   - Déroulement (Tableau) : Étapes (Découverte, Recherche, Institutionnalisation, Transfert), Durée, Tâche enseignant, Activité élève.
   - Trace Écrite : Version complète et version différenciée (trous/schémas).

7. Formules Mathématiques : Utilise impérativement la notation LaTeX pour toutes les expressions mathématiques (fractions, racines, exposants, etc.). 
   - Utilise $...$ pour les formules en ligne (ex: $E=mc^2$).
   - Utilise $$...$$ pour les formules en bloc (ex: $$\frac{a}{b}$$).
   - Ne jamais utiliser de symboles comme ^ ou / pour les mathématiques complexes.

Réponds toujours en format JSON structuré pour que l'application puisse l'afficher correctement.`;

// Helper component for rendering Markdown with Math
const MarkdownRenderer = ({ content, className = "", inline = false }: { content: string, className?: string, inline?: boolean }) => {
  if (!content) return null;
  return (
    <div className={`markdown-content ${className} ${inline ? 'inline-block' : ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: inline ? ({ children }) => <>{children}</> : 'p'
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

// Tailwind Safelist for dynamic theme colors:
// text-emerald-600 text-amber-600 text-red-600 text-blue-600 text-violet-600 text-pink-600
// bg-emerald-600 bg-amber-600 bg-red-600 bg-blue-600 bg-violet-600 bg-pink-600
// bg-emerald-50 bg-amber-50 bg-red-50 bg-blue-50 bg-violet-50 bg-pink-50
// text-emerald-700 text-amber-700 text-red-700 text-blue-700 text-violet-700 text-pink-700
// bg-emerald-500 bg-amber-500 bg-red-500 bg-blue-500 bg-violet-500 bg-pink-500
// border-emerald-500 border-amber-500 border-red-500 border-blue-500 border-violet-500 border-pink-500
// focus:ring-emerald-500/20 focus:ring-amber-500/20 focus:ring-red-500/20 focus:ring-blue-500/20 focus:ring-violet-500/20 focus:ring-pink-500/20
// focus:border-emerald-500 focus:border-amber-500 focus:border-red-500 focus:border-blue-500 focus:border-violet-500 focus:border-pink-500
// text-emerald-500 text-amber-500 text-red-500 text-blue-500 text-violet-500 text-pink-500
// border-l-emerald-500 border-l-amber-500 border-l-red-500 border-l-blue-500 border-l-violet-500 border-l-pink-500
// selection:bg-emerald-100 selection:bg-amber-100 selection:bg-red-100 selection:bg-blue-100 selection:bg-violet-100 selection:bg-pink-100

export default function App() {
  const [activeTab, setActiveTab] = useState<'generator' | 'history' | 'settings'>('generator');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<LessonPlan | null>(null);
  const [history, setHistory] = useState<LessonPlan[]>([]);

  // Settings State
  const [teacherInfo, setTeacherInfo] = useState<TeacherInfo>({ name: '', school: '', specialty: '' });
  const [themeColor, setThemeColor] = useState('green');
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Firebase Auth State
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [savedPlans, setSavedPlans] = useState<LessonPlan[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
      if (currentUser) {
        loadUserPlans(currentUser.uid);
        loadUserSettings(currentUser.uid);
      } else {
        setSavedPlans([]);
        // Local preference loading if not logged in
        const localSettings = localStorage.getItem('teacher_settings');
        if (localSettings) {
          try {
            const parsed = JSON.parse(localSettings);
            setTeacherInfo(parsed.teacherInfo || { name: '', school: '', specialty: '' });
            setThemeColor(parsed.themeColor || 'green');
            setIsDarkMode(parsed.isDarkMode || false);
          } catch (e) { console.error("Error parsing local settings", e); }
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const loadUserPlans = async (userId: string) => {
    try {
      const q = query(
        collection(db, 'fiches'),
        where('userId', '==', userId)
      );
      const querySnapshot = await getDocs(q);
      const plans = querySnapshot.docs.map(doc => {
        const data = doc.data();
        let ts = data.timestamp;
        // Convert Firestore Timestamp to number if applicable
        if (ts && typeof ts === 'object' && typeof ts.toMillis === 'function') {
          ts = ts.toMillis();
        }
        return {
          ...data,
          id: doc.id,
          timestamp: ts || Date.now()
        };
      }) as LessonPlan[];

      // Client-side sorting
      plans.sort((a, b) => b.timestamp - a.timestamp);

      setSavedPlans(plans);
      setHistory(plans);
    } catch (error: any) {
      console.error("Error loading plans:", error);
    }
  };

  const loadUserSettings = async (userId: string) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const data = userDoc.data();
        if (data.teacherInfo) setTeacherInfo(data.teacherInfo);
        if (data.themeColor) setThemeColor(data.themeColor);
        if (data.isDarkMode !== undefined) setIsDarkMode(data.isDarkMode);
      }
    } catch (error) {
      console.error("Error loading user settings:", error);
    }
  };

  const saveUserSettings = async (userId: string, settings: any) => {
    try {
      await setDoc(doc(db, 'users', userId), {
        ...settings,
        lastUpdated: Timestamp.now()
      }, { merge: true });
    } catch (error) {
      console.error("Error saving user settings:", error);
    }
  };

  // Sync settings to Firestore or LocalStorage
  useEffect(() => {
    const settings = { teacherInfo, themeColor, isDarkMode };
    if (user) {
      const timeoutId = setTimeout(() => {
        saveUserSettings(user.uid, settings);
      }, 1000); // Debounce to avoid too many writes
      return () => clearTimeout(timeoutId);
    } else {
      localStorage.setItem('teacher_settings', JSON.stringify(settings));
    }
  }, [teacherInfo, themeColor, isDarkMode, user]);

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [showEmailAuth, setShowEmailAuth] = useState(false);
  const [authError, setAuthError] = useState('');

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (authMode === 'signup') {
        const { createUserWithEmailAndPassword, updateProfile } = await import('firebase/auth');
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: email.split('@')[0] });
      } else {
        const { signInWithEmailAndPassword } = await import('firebase/auth');
        await signInWithEmailAndPassword(auth, email, password);
      }
      setShowEmailAuth(false);
      setEmail('');
      setPassword('');
    } catch (error: any) {
      console.error("Email auth error:", error);
      setAuthError(error.message);
    }
  };

  const handleDeletePlan = async (planId: string) => {
    if (!user) return;
    if (!confirm("Voulez-vous vraiment supprimer cette fiche ?")) return;

    try {
      await deleteDoc(doc(db, 'fiches', planId));
      loadUserPlans(user.uid);
    } catch (error) {
      console.error("Error deleting plan:", error);
    }
  };

  // Form state (CRAFT Method)
  const [context, setContext] = useState('');
  const [role, setRole] = useState('Expert en didactique et ingénierie pédagogique APC');
  const [action, setAction] = useState('');
  const [format, setFormat] = useState('Fiche de préparation structurée');
  const [tone, setTone] = useState('Didactique, rigoureux, conforme au BOEN');

  // Generator Selection State
  const [selectedLevel, setSelectedLevel] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedDuration, setSelectedDuration] = useState('1.0');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [lessonTitle, setLessonTitle] = useState('');
  const [sessionNumber, setSessionNumber] = useState('1');
  const [totalSessions, setTotalSessions] = useState('1');

  const planRef = useRef<HTMLDivElement>(null);

  const exportToPDF = async () => {
    if (!planRef.current || !currentPlan) return;

    setIsExporting(true);
    // Give UI time to update (hide buttons etc) and settle
    await new Promise(resolve => setTimeout(resolve, 500));

    // Wait for fonts to be ready in the main document
    await document.fonts.ready;

    console.log("Starting PDF export for:", currentPlan.title);

    // Set a timeout to alert the user if it takes too long
    const exportTimeout = setTimeout(() => {
      alert("L'exportation prend plus de temps que prévu. Cela peut être dû à la longueur de la fiche ou à la complexité du rendu. Veuillez patienter encore un peu ou essayez de réduire le contenu.");
    }, 10000);

    // 1. Sanitize global styles temporarily to prevent html2canvas parsing errors (unexpected EOF)
    // html2canvas parses all document stylesheets regardless of what element is being captured.
    const styleTags = Array.from(document.querySelectorAll('style'));
    const originalStyles = new Map<HTMLStyleElement, string>();

    styleTags.forEach(tag => {
      originalStyles.set(tag, tag.innerHTML);
      // Replace problematic modern CSS functions with safe fallbacks
      if (tag.innerHTML.includes('oklch') || tag.innerHTML.includes('oklab')) {
        tag.innerHTML = tag.innerHTML.replace(/(oklch|oklab)\s*\([^)]+\)/gi, '#cccccc');
      }
    });

    // 2. Temporarily disable external stylesheets which might contain modern CSS html2canvas can't parse
    const linkTags = Array.from(document.querySelectorAll('link[rel="stylesheet"]')) as HTMLLinkElement[];
    const originalLinkDisabled = new Map<HTMLLinkElement, boolean>();
    linkTags.forEach(tag => {
      originalLinkDisabled.set(tag, tag.disabled);
      tag.disabled = true;
    });

    try {
      const safeTitle = currentPlan.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const element = planRef.current;

      if (!element) throw new Error("Élément introuvable");

      const opt = {
        margin: [15, 15, 15, 15] as [number, number, number, number], // Standard margins to avoid printer cut-off
        filename: `Fiche_${safeTitle}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: 794,
          onclone: (clonedDoc: Document) => {
            // 1. Force body width to A4 proportions in the clone
            clonedDoc.body.style.width = '794px';
            clonedDoc.body.style.overflow = 'visible';
            clonedDoc.body.style.backgroundColor = '#ffffff';

            // 2. Aggressively remove ALL existing stylesheets in the clone to be safe
            const styles = Array.from(clonedDoc.querySelectorAll('style, link[rel="stylesheet"]'));
            styles.forEach(s => s.remove());

            // 2b. Re-add KaTeX CSS specifically for math rendering
            const katexLink = clonedDoc.createElement('link');
            katexLink.rel = 'stylesheet';
            katexLink.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css';
            clonedDoc.head.appendChild(katexLink);

            // 3. Find the plan element in the cloned document
            const clonedPlan = clonedDoc.querySelector('[data-pdf-content="true"]') as HTMLElement;
            if (clonedPlan) {
              clonedPlan.style.width = '100%';
              clonedPlan.style.maxWidth = 'none';
              clonedPlan.style.margin = '0';
              clonedPlan.style.padding = '0'; // Padding is handled by html2pdf margin
              clonedPlan.style.backgroundColor = '#ffffff';
              clonedPlan.style.display = 'block';
            }

            const style = clonedDoc.createElement('style');
            style.innerHTML = `
              /* Expert PDF & Print Styles */
              * {
                box-sizing: border-box !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
                transform: none !important;
                transition: none !important;
                animation: none !important;
                color-scheme: light !important;
                text-rendering: optimizeLegibility !important;
              }
              
              body { 
                width: 100% !important; 
                margin: 0 !important; 
                padding: 0 !important; 
                font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important; 
                background-color: #ffffff !important;
                font-size: 11pt !important;
                line-height: 1.4 !important;
              }

              /* Table Robustness */
              table { 
                width: 100% !important; 
                border-collapse: collapse !important; 
                table-layout: fixed !important; 
                margin-bottom: 1rem !important;
              }
              th, td { 
                word-wrap: break-word !important; 
                overflow-wrap: break-word !important; 
                border: 1px solid #e2e8f0 !important; 
                padding: 6pt !important;
                vertical-align: top !important;
              }
              
              /* Page Break Management */
              tr, p, div, li { 
                page-break-inside: avoid !important; 
                break-inside: avoid-column !important;
              }
              h1, h2, h3, h4, h5, h6 { 
                page-break-after: avoid !important; 
                break-after: avoid !important; 
                margin-top: 1.5rem !important;
                margin-bottom: 0.75rem !important;
              }
              .page-break-before {
                page-break-before: always !important;
                break-before: page !important;
              }

              /* Clean Screen Styles */
              .shadow-sm, .shadow-md, .shadow-lg, .shadow-xl, .shadow-2xl { 
                box-shadow: none !important; 
              }
              ::-webkit-scrollbar { 
                display: none !important; 
              }

              /* Layout Helpers */
              .flex { display: flex !important; }
              .flex-col { flex-direction: column !important; }
              .flex-row { flex-direction: row !important; }
              .items-center { align-items: center !important; }
              .items-start { align-items: flex-start !important; }
              .justify-between { justify-content: space-between !important; }
              .shrink-0 { flex-shrink: 0 !important; }
              .flex-wrap { flex-wrap: wrap !important; }
              
              .gap-1 { gap: 0.25rem !important; }
              .gap-2 { gap: 0.5rem !important; }
              .gap-3 { gap: 0.75rem !important; }
              .gap-4 { gap: 1rem !important; }
              .gap-6 { gap: 1.5rem !important; }
              .gap-8 { gap: 2rem !important; }
              
              .m-0 { margin: 0 !important; }
              .mt-2 { margin-top: 0.5rem !important; }
              .mb-1 { margin-bottom: 0.25rem !important; }
              .mb-2 { margin-bottom: 0.5rem !important; }
              .mb-4 { margin-bottom: 1rem !important; }
              
              .p-4 { padding: 1rem !important; }
              .p-6 { padding: 1.5rem !important; }
              .px-4 { padding-left: 1rem !important; padding-right: 1rem !important; }
              .py-2 { padding-top: 0.5rem !important; padding-bottom: 0.5rem !important; }
              
              .space-y-2 > * + * { margin-top: 0.5rem !important; }
              .space-y-4 > * + * { margin-top: 1rem !important; }
              
              /* Grid Helpers */
              .grid { display: grid !important; }
              .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)) !important; }
              .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
              
              /* Typography */
              .text-left { text-align: left !important; }
              .text-right { text-align: right !important; }
              .text-sm { font-size: 0.875rem !important; }
              .text-base { font-size: 1rem !important; }
              .text-lg { font-size: 1.125rem !important; }
              .text-xl { font-size: 1.25rem !important; }
              .text-2xl { font-size: 1.5rem !important; }
              .font-bold { font-weight: 700 !important; }
              .font-medium { font-weight: 500 !important; }
              
              /* Colors */
              .bg-white { background-color: #ffffff !important; }
              .bg-slate-50 { background-color: #f8fafc !important; }
              .bg-slate-100 { background-color: #f1f5f9 !important; }
              .text-slate-900 { color: #0f172a !important; }
              .text-slate-600 { color: #475569 !important; }
              .border-slate-200 { border-color: #e2e8f0 !important; }

              /* KaTeX specific adjustments for PDF */
              .katex-display { margin: 1em 0 !important; overflow-x: visible !important; overflow-y: visible !important; }
              .katex { font-size: 1.1em !important; line-height: 1.2 !important; text-indent: 0 !important; }
              .katex-html { display: inline-block !important; }
              .katex .base { margin-top: 2px !important; margin-bottom: 2px !important; }
            `;
            clonedDoc.head.appendChild(style);

            // 4. Aggressive oklch/oklab removal: replace in the entire HTML of the cloned body
            const bodyHtml = clonedDoc.body.innerHTML;
            if (bodyHtml.includes('oklch') || bodyHtml.includes('oklab')) {
              clonedDoc.body.innerHTML = bodyHtml.replace(/(oklch|oklab)\s*\([^)]+\)/gi, '#cccccc');
            }
          }
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };

      await html2pdf().from(element).set(opt).save();

      clearTimeout(exportTimeout);
      console.log("PDF save command executed via html2pdf.");
    } catch (error) {
      clearTimeout(exportTimeout);
      console.error("PDF Export error:", error);
      alert("Une erreur est survenue lors de l'exportation du PDF. Veuillez réessayer.");
    } finally {
      // Restore original styles and external links
      styleTags.forEach(tag => {
        const original = originalStyles.get(tag);
        if (original !== undefined) tag.innerHTML = original;
      });
      linkTags.forEach(tag => {
        const original = originalLinkDisabled.get(tag);
        if (original !== undefined) tag.disabled = original;
      });
      setIsExporting(false);
    }
  };

  const generatePlan = async () => {
    const rawKey = import.meta.env.VITE_GEMINI_API_KEY;
    const activeKey = rawKey ? rawKey.trim() : '';
    
    // Diagnostic log (masked) to verify if Netlify injected the key
    if (activeKey) {
      console.log(`[DEBUG] Clé API détectée : ${activeKey.substring(0, 6)}... (Longueur: ${activeKey.length})`);
    } else {
      console.warn("[DEBUG] Aucune clé API VITE_GEMINI_API_KEY n'a été trouvée dans l'environnement.");
    }

    if (!action || !isTeacherInfoComplete) return;
    if (!activeKey) {
      alert("Erreur : La clé API Gemini n'est pas configurée dans l'environnement (Netlify/Local).");
      return;
    }

    setIsGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: activeKey });
      const model = "gemini-2.5-flash";

      const levelName = LEVELS.find(l => l.id === selectedLevel)?.name || selectedLevel;
      const hours = Math.floor(parseFloat(selectedDuration));
      const mins = (parseFloat(selectedDuration) % 1) * 60;
      const durationLabel = mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;

      const fullContext = `
        Enseignant: ${teacherInfo.name} (${teacherInfo.specialty})
        Établissement: ${teacherInfo.school}
        Niveau: ${levelName}
        Classe: ${selectedClass}
        Discipline: ${selectedSubject}
        Titre de la leçon: ${lessonTitle}
        Séance: ${sessionNumber} sur ${totalSessions}
        Durée: ${durationLabel}
        ${context}
      `;

      const prompt = `
        [CONTEXTE: ${fullContext}]
        [RÔLE: ${role}]
        [ACTION: ${action}]
        [FORME: ${format}]
        [TON: ${tone}]
        
        Génère une fiche de préparation complète en suivant les spécifications APC.
        Utilise le titre de la leçon "${lessonTitle}" comme base pour le titre de la séance si approprié.
        Indique bien qu'il s'agit de la séance ${sessionNumber} sur un total de ${totalSessions}.

        Retourne UNIQUEMENT un objet JSON valide avec la structure suivante :
        {
          "title": "Titre de la séance",
          "lessonTitle": "${lessonTitle}",
          "sessionNumber": "${sessionNumber}",
          "totalSessions": "${totalSessions}",
          "level": "${levelName} - ${selectedClass}",
          "subject": "${selectedSubject}",
          "duration": "${durationLabel}",
          "objectives": ["Objectif 1", "Objectif 2"],
          "socleCommun": ["D1", "D2"],
          "steps": [
            { "name": "Découverte", "duration": "10 min", "teacherTask": "...", "studentTask": "..." }
          ],
          "inclusionSidebar": { "ppre": "...", "pap": "...", "pps": "...", "pai": "..." },
          "reflexiveAnalysis": { "prescritVsReel": "...", "heterogeneite": "...", "climatClasse": "..." },
          "traceEcrite": { "complete": "...", "differenciee": "..." },
          "paretoDistillation": ["Concept 1", "Vocabulaire 2"]
        }
      `;

      const result = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json"
        }
      });

      const data = JSON.parse(result.text || '{}');
      const newPlan: LessonPlan = {
        ...data,
        id: crypto.randomUUID(),
        timestamp: Date.now()
      };

      setCurrentPlan(newPlan);

      // Save to Firestore if user is logged in
      if (user) {
        try {
          await addDoc(collection(db, 'fiches'), {
            ...newPlan,
            userId: user.uid,
            timestamp: Timestamp.now()
          });
          loadUserPlans(user.uid);
        } catch (dbError) {
          console.error("Error saving to Firestore:", dbError);
        }
      }

      setHistory(prev => [newPlan, ...prev]);
      setIsEditingPlan(false);
    } catch (error: any) {
      console.error("Generation error:", error);
      if (error.message?.includes('429') || error.message?.includes('quota')) {
        alert("Limite de quota atteinte. L'API Gemini est actuellement très sollicitée sur votre compte gratuit. Veuillez patienter environ une minute avant de réessayer.");
      } else {
        alert("Une erreur est survenue lors de la génération. Veuillez vérifier votre connexion ou réessayer plus tard.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const theme = THEME_COLORS.find(c => c.id === themeColor) || THEME_COLORS[0];
  const themeClass = theme.class;

  const isTeacherInfoComplete = Boolean(teacherInfo.name && teacherInfo.school && teacherInfo.specialty);

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-slate-900 text-slate-100' : 'bg-[#F8F9FA] text-[#1A1A1A]'} font-sans selection:bg-${themeClass}-100 transition-colors duration-300`}>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-full w-64 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border-r z-40 transition-transform duration-300 ease-in-out md:translate-x-0 flex flex-col ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className={`p-6 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-100'} flex items-center justify-between`}>
          <div className={`flex items-center gap-3 text-${themeClass}-600`}>
            <div className={`p-2 bg-${themeClass}-50 rounded-lg`}>
              <BookOpen size={24} />
            </div>
            <h1 className="font-bold text-lg tracking-tight">PR Fiche</h1>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden p-2 text-slate-400">
            <AlertCircle size={20} className="rotate-45" />
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          <button
            onClick={() => { setActiveTab('generator'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'generator' ? `bg-${themeClass}-50 text-${themeClass}-700 font-medium` : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Plus size={20} />
            Générateur
          </button>
          <button
            onClick={() => { setActiveTab('history'); setSidebarOpen(false); }}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${activeTab === 'history' ? `bg-${themeClass}-50 text-${themeClass}-700 font-medium` : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <div className="flex items-center gap-3">
              <History size={20} />
              Historique
            </div>
            {savedPlans.length > 0 && (
              <span className={`px-2 py-0.5 bg-${themeClass}-100 text-${themeClass}-700 text-[10px] font-bold rounded-full`}>
                {savedPlans.length}
              </span>
            )}
          </button>
          <button
            onClick={() => { setActiveTab('settings'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'settings' ? `bg-${themeClass}-50 text-${themeClass}-700 font-medium` : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Settings size={20} />
            Paramètres
          </button>
        </nav>

        <div className={`p-4 border-t ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
          {!user ? (
            <div className="space-y-4">
              <div className={`${isDarkMode ? 'bg-slate-700/50' : 'bg-slate-50'} rounded-xl p-4`}>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-2">Sauvegarde Cloud</p>
                <p className="text-[10px] text-slate-400 leading-tight">Connectez-vous pour sauvegarder vos fiches automatiquement.</p>
              </div>

              {!showEmailAuth ? (
                <div className="space-y-2">
                  <button
                    onClick={handleGoogleLogin}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-all shadow-sm`}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="currentColor" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" />
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z" />
                    </svg>
                    Google
                  </button>
                  <button
                    onClick={() => setShowEmailAuth(true)}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-${themeClass}-600 text-white font-bold hover:bg-${themeClass}-700 transition-all shadow-lg shadow-${themeClass}-500/20`}
                  >
                    <Send size={18} />
                    Email
                  </button>
                </div>
              ) : (
                <form onSubmit={handleEmailAuth} className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    required
                    className={`w-full px-3 py-2 rounded-lg border text-sm ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'} outline-none`}
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mot de passe"
                    required
                    className={`w-full px-3 py-2 rounded-lg border text-sm ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200'} outline-none`}
                  />
                  {authError && <p className="text-[10px] text-red-500 font-medium">{authError}</p>}
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className={`flex-1 py-2 rounded-lg bg-${themeClass}-600 text-white text-xs font-bold hover:bg-${themeClass}-700 transition-all`}
                    >
                      {authMode === 'login' ? 'Connexion' : 'Inscription'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowEmailAuth(false)}
                      className="px-3 py-2 rounded-lg bg-slate-100 text-slate-500 text-xs hover:bg-slate-200 transition-all"
                    >
                      Annuler
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                    className="w-full text-center text-[10px] text-slate-500 hover:text-emerald-600 font-bold"
                  >
                    {authMode === 'login' ? "Pas de compte ? S'inscrire" : "Déjà un compte ? Connexion"}
                  </button>
                </form>
              )}
            </div>
          ) : (
            <div className={`flex items-center gap-3 p-3 ${isDarkMode ? 'bg-slate-700/30' : 'bg-slate-50'} rounded-xl`}>
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || ''} className="w-10 h-10 rounded-full border-2 border-white shadow-sm" />
              ) : (
                <div className={`w-10 h-10 rounded-full bg-${themeClass}-100 flex items-center justify-center text-${themeClass}-600`}>
                  <Users size={20} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold truncate ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                  {user.displayName || 'Utilisateur'}
                </p>
                <button
                  onClick={handleLogout}
                  className="text-[10px] text-slate-500 hover:text-red-500 font-bold uppercase tracking-wider transition-colors"
                >
                  Déconnexion
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="md:ml-64 min-h-screen flex flex-col">
        {/* Header */}
        <header className={`sticky top-0 ${isDarkMode ? 'bg-slate-900/80 border-slate-700' : 'bg-white/80 border-slate-200'} backdrop-blur-md border-b z-10 px-4 md:px-8 py-4 flex items-center justify-between`}>
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
              <Plus size={24} className="rotate-45" />
            </button>
            <h2 className={`text-lg md:text-xl font-semibold ${isDarkMode ? 'text-slate-100' : 'text-slate-800'} truncate`}>
              {activeTab === 'generator' ? 'Conception de Fiche' : activeTab === 'history' ? 'Mes Préparations' : 'Paramètres'}
            </h2>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            {currentPlan && activeTab === 'generator' && (
              <button
                onClick={() => setIsEditingPlan(!isEditingPlan)}
                className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm ${isEditingPlan
                  ? `bg-amber-100 text-amber-700 border border-amber-200`
                  : `${isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-white text-slate-600 border-slate-200'} border`
                  }`}
              >
                {isEditingPlan ? (
                  <>
                    <CheckCircle2 size={18} />
                    <span className="hidden xs:inline">Terminer l'édition</span>
                  </>
                ) : (
                  <>
                    <FileText size={18} />
                    <span className="hidden xs:inline">Modifier manuellement</span>
                  </>
                )}
              </button>
            )}
            <button className="hidden sm:block p-2 text-slate-400 hover:text-slate-600 transition-colors">
              <Share2 size={20} />
            </button>
            <button className="hidden sm:block p-2 text-slate-400 hover:text-slate-600 transition-colors">
              <Printer size={20} />
            </button>
            <button
              onClick={exportToPDF}
              disabled={!currentPlan || isExporting}
              className={`flex items-center gap-2 bg-${themeClass}-600 text-white px-3 md:px-4 py-2 rounded-lg text-sm font-medium hover:bg-${themeClass}-700 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isExporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span className="hidden xs:inline">Exportation...</span>
                </>
              ) : (
                <>
                  <Download size={18} />
                  <span className="hidden xs:inline">Exporter PDF</span>
                </>
              )}
            </button>
          </div>
        </header>

        <div className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full">
          <AnimatePresence mode="wait">
            {activeTab === 'generator' && (
              <motion.div
                key="generator"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                {!isTeacherInfoComplete && (
                  <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-red-900/20 border-red-900/50 text-red-200' : 'bg-red-50 border-red-100 text-red-700'} flex items-center gap-3`}>
                    <AlertCircle size={20} />
                    <p className="text-sm font-medium">Veuillez compléter vos informations personnelles dans les paramètres avant de générer une fiche.</p>
                    <button
                      onClick={() => setActiveTab('settings')}
                      className="ml-auto text-sm font-bold underline"
                    >
                      Aller aux paramètres
                    </button>
                  </div>
                )}

                {/* Generator Form */}
                <section className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} rounded-2xl border shadow-sm overflow-hidden`}>
                  <div className={`p-6 border-b ${isDarkMode ? 'border-slate-700 bg-slate-700/30' : 'border-slate-100 bg-slate-50/50'}`}>
                    <div className={`flex items-center gap-2 text-${themeClass}-600 font-semibold`}>
                      <BrainCircuit size={20} />
                      Configuration de la Séance
                    </div>
                  </div>
                  <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Lesson Title */}
                    <div className="space-y-2 md:col-span-2">
                      <label className={`text-sm font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Titre de la leçon</label>
                      <input
                        type="text"
                        value={lessonTitle}
                        onChange={(e) => setLessonTitle(e.target.value)}
                        placeholder="Ex: Les fractions, La Révolution Française, etc."
                        className={`w-full px-4 py-2 rounded-lg border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-slate-100' : 'bg-white border-slate-200 text-slate-900'} text-sm focus:ring-2 focus:ring-${themeClass}-500/20 outline-none`}
                      />
                    </div>

                    {/* Level Selection */}
                    <div className="space-y-2">
                      <label className={`text-sm font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Niveau d'enseignement</label>
                      <select
                        value={selectedLevel}
                        onChange={(e) => {
                          setSelectedLevel(e.target.value);
                          setSelectedClass('');
                        }}
                        className={`w-full px-4 py-2 rounded-lg border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-slate-100' : 'bg-white border-slate-200 text-slate-900'} text-sm focus:ring-2 focus:ring-${themeClass}-500/20 outline-none`}
                      >
                        <option value="">Sélectionner un niveau</option>
                        {LEVELS.map(level => (
                          <option key={level.id} value={level.id}>{level.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Class Selection */}
                    <div className="space-y-2">
                      <label className={`text-sm font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Classe</label>
                      <select
                        value={selectedClass}
                        onChange={(e) => setSelectedClass(e.target.value)}
                        disabled={!selectedLevel}
                        className={`w-full px-4 py-2 rounded-lg border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-slate-100' : 'bg-white border-slate-200 text-slate-900'} text-sm focus:ring-2 focus:ring-${themeClass}-500/20 outline-none disabled:opacity-50`}
                      >
                        <option value="">Sélectionner une classe</option>
                        {LEVELS.find(l => l.id === selectedLevel)?.classes.map(cls => (
                          <option key={cls} value={cls}>{cls}</option>
                        ))}
                      </select>
                    </div>

                    {/* Duration Selection */}
                    <div className="space-y-2">
                      <label className={`text-sm font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Durée de la séance</label>
                      <select
                        value={selectedDuration}
                        onChange={(e) => setSelectedDuration(e.target.value)}
                        className={`w-full px-4 py-2 rounded-lg border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-slate-100' : 'bg-white border-slate-200 text-slate-900'} text-sm focus:ring-2 focus:ring-${themeClass}-500/20 outline-none`}
                      >
                        {[1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0].map(h => {
                          const hours = Math.floor(h);
                          const mins = (h % 1) * 60;
                          const label = mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
                          return (
                            <option key={h} value={h.toFixed(1)}>{label}</option>
                          );
                        })}
                      </select>
                    </div>

                    {/* Session Numbering */}
                    <div className="space-y-2">
                      <label className={`text-sm font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Numéro de séance</label>
                      <div className="flex items-center gap-2">
                        <select
                          value={sessionNumber}
                          onChange={(e) => setSessionNumber(e.target.value)}
                          className={`flex-1 px-4 py-2 rounded-lg border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-slate-100' : 'bg-white border-slate-200 text-slate-900'} text-sm focus:ring-2 focus:ring-${themeClass}-500/20 outline-none`}
                        >
                          {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                            <option key={n} value={n.toString()}>Séance {n}</option>
                          ))}
                        </select>
                        <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>sur</span>
                        <select
                          value={totalSessions}
                          onChange={(e) => setTotalSessions(e.target.value)}
                          className={`flex-1 px-4 py-2 rounded-lg border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-slate-100' : 'bg-white border-slate-200 text-slate-900'} text-sm focus:ring-2 focus:ring-${themeClass}-500/20 outline-none`}
                        >
                          {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                            <option key={n} value={n.toString()}>{n}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Subject Selection (Conditional) */}
                    {['middle', 'high', 'university'].includes(selectedLevel) && (
                      <div className="space-y-2">
                        <label className={`text-sm font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Discipline</label>
                        <select
                          value={selectedSubject}
                          onChange={(e) => setSelectedSubject(e.target.value)}
                          className={`w-full px-4 py-2 rounded-lg border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-slate-100' : 'bg-white border-slate-200 text-slate-900'} text-sm focus:ring-2 focus:ring-${themeClass}-500/20 outline-none`}
                        >
                          <option value="">Sélectionner une discipline</option>
                          {SUBJECTS.map(sub => (
                            <option key={sub} value={sub}>{sub}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="space-y-2 md:col-span-2">
                      <label className={`text-sm font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'} flex items-center gap-2`}>
                        <Target size={16} className="text-slate-400" />
                        Action (Sous-titres ou précisions)
                      </label>
                      <textarea
                        value={action}
                        onChange={(e) => setAction(e.target.value)}
                        placeholder="Précisez ici les sous-titres, les points clés à aborder ou toute autre consigne spécifique pour la séance."
                        className={`w-full h-24 px-4 py-3 rounded-xl border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-slate-100' : 'bg-white border-slate-200 text-slate-900'} focus:ring-2 focus:ring-${themeClass}-500/20 focus:border-${themeClass}-500 transition-all outline-none resize-none text-sm`}
                      />
                    </div>
                  </div>
                  <div className={`px-8 py-6 ${isDarkMode ? 'bg-slate-700/30 border-slate-700' : 'bg-slate-50 border-slate-100'} border-t flex justify-end`}>
                    <button
                      onClick={generatePlan}
                      disabled={isGenerating || !selectedLevel || !selectedClass || !lessonTitle || !action || !isTeacherInfoComplete}
                      className={`flex items-center gap-2 bg-${themeClass}-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-${themeClass}-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {isGenerating ? (
                        <span key="loading" className="flex items-center gap-2">
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Génération...
                        </span>
                      ) : (
                        <span key="idle" className="flex items-center gap-2">
                          <Sparkles size={20} />
                          Générer la Fiche
                        </span>
                      )}
                    </button>
                  </div>
                </section>

                {/* Generated Result */}
                {currentPlan && (
                  <div className="space-y-4">
                    {isEditingPlan && (
                      <div className={`p-3 rounded-lg border ${isDarkMode ? 'bg-amber-900/20 border-amber-900/50 text-amber-200' : 'bg-amber-50 border-amber-100 text-amber-700'} text-xs flex items-center gap-2 animate-pulse`}>
                        <AlertCircle size={14} />
                        Mode édition actif : Cliquez sur n'importe quel texte pour le modifier. Les modifications sont temporaires et destinées à l'exportation.
                      </div>
                    )}
                    <motion.div
                      ref={planRef}
                      data-pdf-content="true"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      contentEditable={isEditingPlan}
                      suppressContentEditableWarning={true}
                      className={`space-y-8 pb-20 outline-none transition-all ${isEditingPlan ? 'cursor-text ring-2 ring-emerald-500/20 p-4 rounded-2xl bg-emerald-50/5' : ''}`}
                    >
                      {/* Lesson Header */}
                      <div className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} rounded-2xl border shadow-lg p-6 md:p-8`}>
                        <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-8">
                          <div>
                            <span className={`inline-block px-3 py-1 bg-${themeClass}-100 text-${themeClass}-700 text-xs font-bold rounded-full uppercase tracking-wider mb-3`}>
                              {currentPlan.level} • {currentPlan.subject}
                              {currentPlan.sessionNumber && currentPlan.totalSessions && (
                                <span className="ml-2 border-l border-current pl-2">
                                  Séance {currentPlan.sessionNumber}/{currentPlan.totalSessions}
                                </span>
                              )}
                            </span>
                            <h3 className={`text-2xl md:text-3xl font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                              <MarkdownRenderer content={currentPlan.title} inline={true} />
                            </h3>
                            <div className="mt-2 space-y-1">
                              <p className="text-sm text-slate-500 flex items-center gap-2">
                                <Users size={14} />
                                Par {teacherInfo.name}
                              </p>
                              <p className="text-sm text-slate-500 flex items-center gap-2">
                                <School size={14} />
                                {teacherInfo.school}
                              </p>
                            </div>
                          </div>
                          <div className="md:text-right">
                            <p className="text-sm text-slate-500 font-medium">Durée Totale</p>
                            <p className={`text-xl font-bold text-${themeClass}-600`}>{currentPlan.duration}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-4">
                            <h4 className={`font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'} flex items-center gap-2`}>
                              <Target size={18} className={`text-${themeClass}-500`} />
                              Objectifs Opérationnels (SMART)
                            </h4>
                            <ul className="space-y-2">
                              {currentPlan.objectives.map((obj, i) => (
                                <li key={i} className={`flex gap-3 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                                  <CheckCircle2 size={16} className={`text-${themeClass}-500 shrink-0 mt-0.5`} />
                                  <MarkdownRenderer content={obj} inline={true} />
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="space-y-4">
                            <h4 className={`font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'} flex items-center gap-2`}>
                              <Layers size={18} className={`text-${themeClass}-500`} />
                              Socle Commun & Pareto
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {currentPlan.socleCommun.map((domain, i) => (
                                <span key={i} className={`${isDarkMode ? 'bg-slate-700 text-slate-300 border-slate-600' : 'bg-slate-100 text-slate-600 border-slate-200'} px-2 py-1 text-[10px] font-bold rounded border`}>
                                  {domain}
                                </span>
                              ))}
                            </div>
                            <div className={`${isDarkMode ? 'bg-amber-900/20 border-amber-900/50' : 'bg-amber-50 border-amber-100'} p-4 rounded-xl border`}>
                              <p className="text-[10px] font-bold text-amber-700 uppercase mb-2">Distillation 80/20 (Essentiels)</p>
                              <div className="flex flex-wrap gap-2">
                                {currentPlan.paretoDistillation.map((item, i) => (
                                  <span key={i} className="text-sm text-amber-800 font-medium italic flex items-center gap-1">
                                    • <MarkdownRenderer content={item} inline={true} />
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Steps Table */}
                      <div className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} rounded-2xl border shadow-sm overflow-hidden overflow-x-auto`}>
                        <table className="w-full text-left border-collapse min-w-[600px]">
                          <thead>
                            <tr className={`${isDarkMode ? 'bg-slate-700/50 border-slate-700' : 'bg-slate-50 border-slate-200'} border-b`}>
                              <th className="px-4 md:px-6 py-4 text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest">Étape</th>
                              <th className="px-4 md:px-6 py-4 text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest w-24">Durée</th>
                              <th className="px-4 md:px-6 py-4 text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest">Tâche Enseignant</th>
                              <th className="px-4 md:px-6 py-4 text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest">Activité Élève</th>
                            </tr>
                          </thead>
                          <tbody>
                            {currentPlan.steps.map((step, i) => (
                              <tr key={i} className={`${isDarkMode ? 'border-slate-700 hover:bg-slate-700/30' : 'border-slate-100 hover:bg-slate-50/50'} border-b transition-colors`}>
                                <td className={`px-4 md:px-6 py-6 font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'} text-sm`}>{step.name}</td>
                                <td className={`px-4 md:px-6 py-6 text-xs md:text-sm font-mono text-${themeClass}-600`}>{step.duration}</td>
                                <td className={`px-4 md:px-6 py-6 text-xs md:text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'} leading-relaxed`}>
                                  <MarkdownRenderer content={step.teacherTask} />
                                </td>
                                <td className={`px-4 md:px-6 py-6 text-xs md:text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'} leading-relaxed`}>
                                  <MarkdownRenderer content={step.studentTask} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Inclusion Sidebar, Trace Ecrite & Reflexive Analysis */}
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-1 space-y-6">
                          <div className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} rounded-2xl border-l-4 border-l-${themeClass}-500 border p-6 shadow-sm`}>
                            <h4 className={`font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'} flex items-center gap-2 mb-4`}>
                              <Accessibility size={18} className={`text-${themeClass}-500`} />
                              Inclusion Sidebar
                            </h4>
                            <div className="space-y-4">
                              {Object.entries(currentPlan.inclusionSidebar).map(([key, value]) => (
                                <div key={key}>
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{key}</p>
                                  <MarkdownRenderer content={value} className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'} leading-relaxed`} />
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} rounded-2xl border-l-4 border-l-amber-500 border p-6 shadow-sm`}>
                            <h4 className={`font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'} flex items-center gap-2 mb-4`}>
                              <Lightbulb size={18} className="text-amber-500" />
                              Analyse Réflexive (P3)
                            </h4>
                            <div className="space-y-4">
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Prescrit vs Réel</p>
                                <MarkdownRenderer content={currentPlan.reflexiveAnalysis.prescritVsReel} className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'} leading-relaxed`} />
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Hétérogénéité</p>
                                <MarkdownRenderer content={currentPlan.reflexiveAnalysis.heterogeneite} className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'} leading-relaxed`} />
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Climat de Classe</p>
                                <MarkdownRenderer content={currentPlan.reflexiveAnalysis.climatClasse} className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'} leading-relaxed`} />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="lg:col-span-2 space-y-6">
                          <div className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} rounded-2xl border p-8 shadow-sm`}>
                            <h4 className={`font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'} flex items-center gap-2 mb-6`}>
                              <FileText size={18} className={`text-${themeClass}-500`} />
                              Trace Écrite & Institutionnalisation
                            </h4>
                            <div className="space-y-6">
                              <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Version Complète (Référence)</p>
                                <div className={`${isDarkMode ? 'bg-slate-700/50 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-100 text-slate-700'} p-4 rounded-xl text-sm leading-relaxed border`}>
                                  <MarkdownRenderer content={currentPlan.traceEcrite.complete} />
                                </div>
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Version Différenciée (Besoins Particuliers)</p>
                                <div className={`${isDarkMode ? 'bg-emerald-900/10 border-emerald-900/30 text-emerald-200' : 'bg-[#f0fdf4] border-[#d1fae5] text-slate-700'} p-4 rounded-xl text-sm leading-relaxed border italic`}>
                                  <MarkdownRenderer content={currentPlan.traceEcrite.differenciee} />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'history' && (
              <motion.div
                key="history"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-6"
              >
                {!user ? (
                  <div className="col-span-full py-20 text-center space-y-6">
                    <div className={`w-20 h-20 ${isDarkMode ? 'bg-slate-800 text-slate-600' : 'bg-slate-100 text-slate-400'} rounded-full flex items-center justify-center mx-auto`}>
                      <Users size={32} />
                    </div>
                    <div className="max-w-sm mx-auto">
                      <h4 className={`text-lg font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-800'} mb-2`}>Historique non synchronisé</h4>
                      <p className="text-slate-500 text-sm mb-6">Connectez-vous avec Google pour sauvegarder vos fiches de préparation et y accéder depuis n'importe quel appareil.</p>
                      <button
                        onClick={handleGoogleLogin}
                        className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-${themeClass}-600 text-white font-bold hover:bg-${themeClass}-700 transition-all shadow-lg shadow-${themeClass}-500/20`}
                      >
                        <Users size={18} />
                        Se connecter avec Google
                      </button>
                    </div>
                  </div>
                ) : history.length === 0 ? (
                  <div className="col-span-full py-20 text-center space-y-4">
                    <div className={`w-16 h-16 ${isDarkMode ? 'bg-slate-800 text-slate-600' : 'bg-slate-100 text-slate-400'} rounded-full flex items-center justify-center mx-auto`}>
                      <History size={32} />
                    </div>
                    <p className="text-slate-500 font-medium">Aucune fiche sauvegardée dans le cloud.</p>
                  </div>
                ) : (
                  history.map((plan) => (
                    <div
                      key={plan.id}
                      className={`group relative ${isDarkMode ? 'bg-slate-800 border-slate-700 hover:border-slate-500' : 'bg-white border-slate-200 hover:border-emerald-500'} p-6 rounded-2xl border text-left hover:shadow-md transition-all`}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <span className={`${isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500'} px-2 py-1 text-[10px] font-bold rounded uppercase`}>
                          {plan.level}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 font-medium">
                            {new Date(plan.timestamp).toLocaleDateString()}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeletePlan(plan.id); }}
                            className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <AlertCircle size={14} className="rotate-45" />
                          </button>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setCurrentPlan(plan);
                          setActiveTab('generator');
                          setIsEditingPlan(false);
                        }}
                        className="w-full text-left"
                      >
                        <h4 className={`font-bold ${isDarkMode ? 'text-slate-100 group-hover:text-emerald-400' : 'text-slate-800 group-hover:text-emerald-600'} transition-colors mb-2`}>
                          {plan.title}
                        </h4>
                        <p className="text-xs text-slate-500 line-clamp-2">{plan.objectives[0]}</p>
                        <div className={`mt-4 flex items-center justify-between text-${themeClass}-600 font-bold text-xs`}>
                          Charger la fiche
                          <ChevronRight size={14} />
                        </div>
                      </button>
                    </div>
                  ))
                )}
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div
                key="settings"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-8"
              >
                {/* Teacher Info */}
                <section className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} rounded-2xl border p-8 max-w-2xl`}>
                  <h3 className={`text-lg font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-800'} mb-6 flex items-center gap-2`}>
                    <Users size={20} className={`text-${themeClass}-500`} />
                    Informations Personnelles
                  </h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className={`text-sm font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Nom complet *</label>
                      <input
                        type="text"
                        value={teacherInfo.name}
                        onChange={(e) => setTeacherInfo({ ...teacherInfo, name: e.target.value })}
                        placeholder="Ex: Jean Dupont"
                        className={`w-full px-4 py-2 rounded-lg border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-slate-100' : 'bg-white border-slate-200 text-slate-900'} outline-none focus:ring-2 focus:ring-${themeClass}-500/20`}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className={`text-sm font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Établissement scolaire *</label>
                      <input
                        type="text"
                        value={teacherInfo.school}
                        onChange={(e) => setTeacherInfo({ ...teacherInfo, school: e.target.value })}
                        placeholder="Ex: Lycée Victor Hugo"
                        className={`w-full px-4 py-2 rounded-lg border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-slate-100' : 'bg-white border-slate-200 text-slate-900'} outline-none focus:ring-2 focus:ring-${themeClass}-500/20`}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className={`text-sm font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Grade / Spécialité *</label>
                      <input
                        type="text"
                        value={teacherInfo.specialty}
                        onChange={(e) => setTeacherInfo({ ...teacherInfo, specialty: e.target.value })}
                        placeholder="Ex: Professeur Agrégé de Mathématiques"
                        className={`w-full px-4 py-2 rounded-lg border ${isDarkMode ? 'bg-slate-700 border-slate-600 text-slate-100' : 'bg-white border-slate-200 text-slate-900'} outline-none focus:ring-2 focus:ring-${themeClass}-500/20`}
                      />
                    </div>
                  </div>
                </section>

                {/* Theme & Display */}
                <section className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} rounded-2xl border p-8 max-w-2xl`}>
                  <h3 className={`text-lg font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-800'} mb-6 flex items-center gap-2`}>
                    <Palette size={20} className={`text-${themeClass}-500`} />
                    Apparence & Thème
                  </h3>
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Mode Sombre</p>
                        <p className="text-sm text-slate-500">Activer l'interface sombre</p>
                      </div>
                      <button
                        onClick={() => setIsDarkMode(!isDarkMode)}
                        className={`w-12 h-6 rounded-full transition-colors relative ${isDarkMode ? `bg-${themeClass}-600` : 'bg-slate-200'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isDarkMode ? 'left-7' : 'left-1'} flex items-center justify-center`}>
                          {isDarkMode ? <Moon size={10} className={`text-${themeClass}-600`} /> : <Sun size={10} className="text-slate-400" />}
                        </div>
                      </button>
                    </div>

                    <div className="space-y-3">
                      <p className={`font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Couleur du Thème</p>
                      <div className="flex flex-wrap gap-3">
                        {THEME_COLORS.map(color => (
                          <button
                            key={color.id}
                            onClick={() => setThemeColor(color.id)}
                            className={`group flex flex-col items-center gap-1`}
                          >
                            <div className={`w-10 h-10 rounded-full border-2 transition-all ${themeColor === color.id ? `border-${color.class}-500 scale-110 shadow-lg` : 'border-transparent hover:scale-105'} bg-${color.class}-500`} />
                            <span className={`text-[10px] font-bold ${themeColor === color.id ? `text-${color.class}-600` : 'text-slate-400'}`}>{color.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>

                <section className={`${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} rounded-2xl border p-8 max-w-2xl`}>
                  <h3 className={`text-lg font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-800'} mb-6`}>Configuration de l'Assistant</h3>
                  <div className="space-y-6">
                    <div className={`flex items-center justify-between p-4 ${isDarkMode ? 'bg-slate-700/50' : 'bg-slate-50'} rounded-xl`}>
                      <div>
                        <p className={`font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Modèle IA</p>
                        <p className="text-sm text-slate-500">Gemini 3.1 Pro (Preview)</p>
                      </div>
                      <div className={`px-3 py-1 bg-${themeClass}-100 text-${themeClass}-700 text-xs font-bold rounded-full`}>
                        OPTIMISÉ
                      </div>
                    </div>
                    <div className="pt-4">
                      <button
                        onClick={() => {
                          if (confirm('Voulez-vous vraiment effacer tout l\'historique ?')) {
                            setHistory([]);
                          }
                        }}
                        className="text-red-500 text-sm font-bold hover:underline"
                      >
                        Effacer tout l'historique
                      </button>
                    </div>
                  </div>
                </section>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
