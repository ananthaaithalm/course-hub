import { Injectable } from '@angular/core';
import { initializeApp, getApp } from 'firebase/app';
import {
  Auth,
  User,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
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
  updateDoc,
  where
} from 'firebase/firestore';
import { Observable, of } from 'rxjs';
import { firebaseConfig } from './firebase-config';
import { Course, Enrollment, AppUser } from './models';

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

  signIn(email: string, password: string): Promise<any> {
    return signInWithEmailAndPassword(this.auth, email, password);
  }

  signUp(email: string, password: string): Promise<any> {
    return createUserWithEmailAndPassword(this.auth, email, password);
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
