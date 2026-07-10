import { Injectable } from '@angular/core';
import { initializeApp, getApp } from 'firebase/app';
import {
  Auth,
  GoogleAuthProvider,
  User,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut
} from 'firebase/auth';
import {
  Firestore,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';
import { Observable, of } from 'rxjs';
import { firebaseConfig } from './firebase-config';
import { Course, Enrollment, AppUser, Progress } from './models';

const firebaseApp = initializeApp(firebaseConfig);

@Injectable({ providedIn: 'root' })
export class CourseService {
  private firestore: Firestore = getFirestore(firebaseApp);
  private auth: Auth = getAuth(firebaseApp);

  getCourses(): Observable<Course[]> {
    return new Observable<Course[]>((observer) => {
      const coursesRef = collection(this.firestore, 'courses');
      const unsubscribe = onSnapshot(coursesRef, (snapshot) => {
        observer.next(snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Course, 'id'>)
        })));
      }, observer.error.bind(observer));
      return unsubscribe;
    });
  }

  getEnrollments(courseId: string): Observable<Enrollment[]> {
    return new Observable<Enrollment[]>((observer) => {
      const ref = collection(this.firestore, 'enrollments');
      const q = query(ref, where('courseId', '==', courseId));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        observer.next(snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Enrollment, 'id'>)
        })));
      }, observer.error.bind(observer));
      return unsubscribe;
    });
  }

  getProgress(courseId: string, learnerId: string): Observable<Progress | null> {
    return new Observable<Progress | null>((observer) => {
      const ref = collection(this.firestore, 'progress');
      const q = query(
        ref,
        where('courseId', '==', courseId),
        where('learnerId', '==', learnerId)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const progressDoc = snapshot.docs[0];
        observer.next(progressDoc ? ({
          id: progressDoc.id,
          ...(progressDoc.data() as Omit<Progress, 'id'>)
        }) : null);
      }, observer.error.bind(observer));
      return unsubscribe;
    });
  }

  getProgressForLearner(learnerId: string): Observable<Progress[]> {
    return new Observable<Progress[]>((observer) => {
      const ref = collection(this.firestore, 'progress');
      const q = query(ref, where('learnerId', '==', learnerId));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        observer.next(snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Progress, 'id'>)
        })));
      }, observer.error.bind(observer));
      return unsubscribe;
    });
  }

  async updateProgress(progress: Progress): Promise<void> {
    if (!progress.id) {
      throw new Error('Progress document id missing');
    }
    await updateDoc(doc(this.firestore, 'progress', progress.id), {
      completedLessons: progress.completedLessons,
      updatedAt: progress.updatedAt
    });
  }

  async createProgress(progress: Omit<Progress, 'id'>): Promise<void> {
    await addDoc(collection(this.firestore, 'progress'), progress);
  }

  async completeLesson(courseId: string, learnerId: string, totalLessons: number): Promise<void> {
    const ref = collection(this.firestore, 'progress');
    const q = query(
      ref,
      where('courseId', '==', courseId),
      where('learnerId', '==', learnerId)
    );
    const snapshot = await getDocs(q);
    const now = new Date().toISOString();
    if (snapshot.empty) {
      await addDoc(collection(this.firestore, 'progress'), {
        courseId,
        learnerId,
        completedLessons: 1,
        totalLessons,
        updatedAt: now
      });
      return;
    }

    const docSnap = snapshot.docs[0];
    const progress = docSnap.data() as Progress;
    const nextCompleted = Math.min((progress.completedLessons || 0) + 1, totalLessons);
    await updateDoc(doc(this.firestore, 'progress', docSnap.id), {
      completedLessons: nextCompleted,
      updatedAt: now
    });
  }

  async createCourse(course: Omit<Course, 'id'>): Promise<void> {
    await addDoc(collection(this.firestore, 'courses'), course);
  }

  async updateCourse(course: Course): Promise<void> {
    if (!course.id) {
      throw new Error('Course id missing');
    }
    await updateDoc(doc(this.firestore, 'courses', course.id), {
      title: course.title,
      trainer: course.trainer,
      seats: course.seats,
      startAt: course.startAt
    });
  }

  async deleteCourse(courseId: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'courses', courseId));
  }

  async enrollLearner(courseId: string, learnerId: string): Promise<void> {
    const q = query(collection(this.firestore, 'enrollments'), where('courseId', '==', courseId));
    const snapshot = await getDocs(q);
    const existing = snapshot.docs.some((docSnap) => docSnap.data()['learnerId'] === learnerId);
    if (existing) {
      throw new Error('Learner already enrolled');
    }

    const courseDoc = await getDoc(doc(this.firestore, 'courses', courseId));
    const courseData = courseDoc.data() as Course | undefined;
    if (!courseData) {
      throw new Error('Course not found');
    }
    if (snapshot.size >= courseData.seats) {
      throw new Error('Course is full');
    }

    await addDoc(collection(this.firestore, 'enrollments'), {
      courseId,
      learnerId,
      at: new Date().toISOString()
    });
  }

  async ensureSampleCourses(): Promise<void> {
    const coursesSnapshot = await getDocs(collection(this.firestore, 'courses'));
    if (!coursesSnapshot.empty) {
      return;
    }

    const sampleCourses = [
      {
        title: 'Agile Project Management',
        trainer: 'Priya Sharma',
        seats: 25,
        startAt: '2026-08-05'
      },
      {
        title: 'Advanced TypeScript',
        trainer: 'Ravi Patel',
        seats: 30,
        startAt: '2026-08-15'
      },
      {
        title: 'Design Thinking Workshop',
        trainer: 'Maya Nair',
        seats: 20,
        startAt: '2026-09-02'
      },
      {
        title: 'Cloud Solutions Fundamentals',
        trainer: 'Amit Verma',
        seats: 28,
        startAt: '2026-08-22'
      }
    ];

    await Promise.all(sampleCourses.map((course) => addDoc(collection(this.firestore, 'courses'), course)));
  }

  signIn(email: string, password: string): Promise<any> {
    return signInWithEmailAndPassword(this.auth, email, password);
  }

  signUp(email: string, password: string): Promise<any> {
    return createUserWithEmailAndPassword(this.auth, email, password);
  }

  async signInWithGoogle(): Promise<any> {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(this.auth, provider);
  }

  signOutUser(): Promise<void> {
    return signOut(this.auth);
  }

  authState(): Observable<User | null> {
    return new Observable((observer) => onAuthStateChanged(this.auth, (user) => observer.next(user), observer.error.bind(observer)));
  }

  getUserRole(user: User | null): Observable<AppUser | null> {
    if (!user?.email) {
      return of(null);
    }
    const role = user.email === 'coordinator@coursehub.com' ? 'coordinator' : 'learner';
    return of({ uid: user.uid, email: user.email, role });
  }
}
