
export enum SchoolLevel {
  PRIMARY = 'Primaire',
  MIDDLE_SCHOOL = 'Collège',
  HIGH_SCHOOL = 'Lycée',
  UNIVERSITY = 'Université',
  PROFESSIONAL = 'Professionnel'
}

export enum PedagogicalMethod {
  EXPOSITORY = 'Exposé',
  GROUP_WORK = 'Travail de groupe',
  FLIPPED_CLASSROOM = 'Classe inversée',
  PROJECT_BASED = 'Pédagogie de projet'
}

export enum LessonObjective {
  DISCOVERY = 'Découverte',
  REVISION = 'Révision',
  EVALUATION = 'Évaluation',
  DEEPENING = 'Approfondissement'
}

export interface LessonPlanRequest {
  subject: string;
  level: SchoolLevel;
  grade: string;
  duration: number;
  objective: LessonObjective;
  method: PedagogicalMethod;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  sources?: { title: string; uri: string }[];
  attachment?: {
    mimeType: string;
    data: string; // base64
  };
}

export interface SavedLesson {
  id: string;
  subject: string;
  level: SchoolLevel;
  content: string;
  createdAt: number;
  lastModified: number;
}

// Theme Types
export type AccentColor = 'ocean' | 'purple' | 'green' | 'red' | 'gold';
export type ThemeMode = 'sky' | 'night';

export interface ThemeSettings {
  color: AccentColor;
  mode: ThemeMode;
  teacherName?: string;
  teacherPhone?: string;
}