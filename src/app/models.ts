export interface Course {
  id?: string;
  title: string;
  trainer: string;
  seats: number;
  startAt: string;
  totalLessons?: number;
}

export interface Enrollment {
  id?: string;
  courseId: string;
  learnerId: string;
  at: string;
}

export interface Progress {
  id?: string;
  courseId: string;
  learnerId: string;
  completedLessons: number;
  totalLessons: number;
  updatedAt: string;
}

export interface AppUser {
  uid: string;
  email: string | null;
  role: 'coordinator' | 'learner';
}
