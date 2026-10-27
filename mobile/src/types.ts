export type Role = "Student" | "Teacher" | "Coordinator" | "Admin";
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
}
export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: User;
}
export interface Course {
  id: string;
  title: string;
  description: string;
  published: boolean;
  lessonCount: number;
}
export interface Lesson {
  id: string;
  moduleId: string;
  moduleTitle: string;
  title: string;
  content: string;
  completed: boolean;
  position: number;
  available: boolean;
  learningCycle: number;
}
export interface Enrollment {
  id: string;
  courseId: string;
  courseTitle: string;
  totalLessons: number;
  completedLessons: number;
  progress: number;
  learningCycle: number;
}
export interface AssessmentSummary {
  id: string;
  title: string;
  questions: number;
  available: boolean;
}
export interface Assessment {
  id: string;
  title: string;
  courseId: string;
  questions: {
    id: string;
    prompt: string;
    imagePath?: string | null;
    imageAlt?: string | null;
    options: { id: string; text: string }[];
  }[];
}
export interface Attempt {
  id: string;
  assessmentId: string;
  score: number;
  submittedAt: string;
}
export interface Operation {
  operationId: string;
  lessonId: string;
  learningCycle?: number;
}
export interface QuizSession {
  id: string;
  assessmentId: string;
  deadline: string;
  serverTime: string;
  answers: { questionId: string; optionId: string }[];
}
export interface SyncItem {
  operationId: string;
  success: boolean;
  error: string | null;
}
export interface SyncResult {
  results: SyncItem[];
  enrollments: Enrollment[];
  serverTime: string;
}
