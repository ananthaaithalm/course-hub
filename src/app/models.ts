export interface Course {
  id?: string;
  title: string;
  trainer: string;
  seats: number;
  startAt: string;
}

export interface Enrollment {
  id?: string;
  courseId: string;
  learnerId: string;
  at: string;
}

export interface AppUser {
  uid: string;
  email: string | null;
  role: 'coordinator' | 'learner';
}
