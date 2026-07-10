import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CourseService } from './course.service';
import { Course, Enrollment, AppUser, Progress } from './models';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  private courseService = inject(CourseService);

  courses: Course[] = [];
  enrollmentsByCourse: Record<string, Enrollment[]> = {};
  selectedCourse: Course | null = null;
  selectedProgress: Progress | null = null;
  myProgress: Progress[] = [];
  progressByCourse: Record<string, Progress> = {};
  viewMode: 'dashboard' | 'enrolled' | 'details' = 'dashboard';
  user: AppUser | null = null;
  email = '';
  password = '';
  search = '';

  editingCourse: Course | null = null;
  formCourse: Partial<Course> = {};

  loading = false;
  error = '';
  success = '';
  toastMessage = '';
  toastType: 'success' | 'error' | 'info' = 'success';
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      const savedEmail = window.localStorage.getItem('coursehub-email') || '';
      const savedPassword = window.localStorage.getItem('coursehub-password') || '';
      if (savedEmail) {
        this.email = savedEmail;
      }
      if (savedPassword) {
        this.password = savedPassword;
      }
    }

    this.courseService.authState().subscribe(async (user) => {
      this.loading = true;
      this.courseService.getUserRole(user).subscribe(async (role) => {
        this.user = role;
        if (role) {
          await this.courseService.ensureSampleCourses();
          this.loadCourses();
          if (role.role === 'learner') {
            this.subscribeLearnerProgress(role.uid);
          }
          this.loading = false;
        } else {
          this.loading = false;
        }
      });
    });
  }

  async signIn(): Promise<void> {
    this.error = '';
    this.success = '';
    try {
      if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
        window.localStorage.setItem('coursehub-email', this.email);
        window.localStorage.setItem('coursehub-password', this.password);
      }
      await this.courseService.signIn(this.email, this.password);
      this.showToast('Signed in successfully', 'success');
    } catch (err: any) {
      this.error = err?.message ?? 'Unable to sign in';
    }
  }

  async signUp(): Promise<void> {
    this.error = '';
    this.success = '';
    try {
      if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
        window.localStorage.setItem('coursehub-email', this.email);
        window.localStorage.setItem('coursehub-password', this.password);
      }
      await this.courseService.signUp(this.email, this.password);
      this.showToast('Account created', 'success');
    } catch (err: any) {
      this.error = err?.message ?? 'Unable to create account';
    }
  }

  async signInWithGoogle(): Promise<void> {
    this.error = '';
    this.success = '';
    this.loading = true;
    try {
      await this.courseService.signInWithGoogle();
      this.showToast('Signed in with Google', 'success');
    } catch (err: any) {
      this.error = err?.message ?? 'Unable to sign in with Google';
      this.showToast(this.error, 'error');
    } finally {
      this.loading = false;
    }
  }

  async signOut(): Promise<void> {
    await this.courseService.signOutUser();
    this.user = null;
    this.courses = [];
    this.enrollmentsByCourse = {};
    this.myProgress = [];
    this.progressByCourse = {};
    this.selectedCourse = null;
    this.selectedProgress = null;
    this.viewMode = 'dashboard';
  }

  loadCourses(): void {
    this.courseService.getCourses().subscribe((courses) => {
      this.courses = courses;
      this.courses.forEach((course) => {
        if (course.id) {
          this.courseService.getEnrollments(course.id).subscribe((enrollments) => {
            this.enrollmentsByCourse[course.id!] = enrollments;
          });
        }
      });
    });
  }

  viewCourseDetails(course: Course): void {
    this.selectedCourse = course;
    this.viewMode = 'details';
    if (course.id && this.progressByCourse[course.id]) {
      this.selectedProgress = this.progressByCourse[course.id];
    } else {
      this.selectedProgress = null;
    }
  }

  backToDashboard(): void {
    this.viewMode = 'dashboard';
    this.selectedCourse = null;
    this.selectedProgress = null;
  }

  viewMyCourses(): void {
    this.viewMode = 'enrolled';
    this.selectedCourse = null;
    this.selectedProgress = null;
    // Reload course data to ensure enrolled courses are properly displayed
    if (!this.courses.length) {
      this.loadCourses();
    }
  }

  subscribeLearnerProgress(learnerId: string): void {
    this.courseService.getProgressForLearner(learnerId).subscribe((progress) => {
      this.myProgress = progress;
      this.progressByCourse = progress.reduce((map, entry) => {
        if (entry.courseId) {
          map[entry.courseId] = entry;
        }
        return map;
      }, {} as Record<string, Progress>);
      if (this.selectedCourse?.id && this.progressByCourse[this.selectedCourse.id]) {
        this.selectedProgress = this.progressByCourse[this.selectedCourse.id];
      }
      // Ensure courses are loaded when progress updates
      if (this.courses.length === 0) {
        this.loadCourses();
      }
    });
  }

  async enrollInCourse(course: Course): Promise<void> {
    if (!this.user) {
      this.error = 'Please sign in first';
      return;
    }
    try {
      this.loading = true;
      await this.courseService.enrollLearner(course.id!, this.user.uid);
      this.showToast('Enrolled successfully', 'success');
      if (this.user.role === 'learner') {
        const totalLessons = course.totalLessons || 5;
        const newProgress: Progress = {
          courseId: course.id!,
          learnerId: this.user.uid,
          completedLessons: 0,
          totalLessons,
          updatedAt: new Date().toISOString()
        };
        await this.courseService.createProgress(newProgress);
        if (course.id) {
          this.progressByCourse[course.id] = newProgress;
          this.myProgress = [...this.myProgress, newProgress];
        }
      }
      this.loadCourses();
      this.backToDashboard();
    } catch (err: any) {
      this.error = err?.message ?? 'Enrollment failed';
      this.showToast(this.error, 'error');
    } finally {
      this.loading = false;
    }
  }

  showToast(message: string, type: 'success' | 'error' | 'info' = 'success'): void {
    this.toastMessage = message;
    this.toastType = type;
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
    this.toastTimer = setTimeout(() => this.hideToast(), 4000);
  }

  hideToast(): void {
    this.toastMessage = '';
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
  }

  startCreate(): void {
    this.editingCourse = null;
    this.formCourse = { title: '', trainer: '', seats: 10, startAt: '' };
  }

  startEdit(course: Course): void {
    this.editingCourse = course;
    this.formCourse = { ...course };
  }

  async saveCourse(): Promise<void> {
    if (!this.formCourse.title || !this.formCourse.trainer || !this.formCourse.seats || !this.formCourse.startAt) {
      this.error = 'Please fill all fields';
      return;
    }
    this.error = '';
    try {
      if (this.editingCourse?.id) {
        await this.courseService.updateCourse({ ...this.editingCourse, ...this.formCourse } as Course);
      } else {
        await this.courseService.createCourse({
          title: this.formCourse.title!,
          trainer: this.formCourse.trainer!,
          seats: Number(this.formCourse.seats),
          startAt: this.formCourse.startAt!
        });
      }
      this.success = this.editingCourse ? 'Course updated' : 'Course created';
      this.formCourse = {};
      this.editingCourse = null;
      this.loadCourses();
    } catch (err: any) {
      this.error = err?.message ?? 'Unable to save course';
    }
  }

  async deleteCourse(courseId: string): Promise<void> {
    try {
      await this.courseService.deleteCourse(courseId);
      this.success = 'Course deleted';
      this.loadCourses();
    } catch (err: any) {
      this.error = err?.message ?? 'Unable to delete course';
    }
  }

  async enroll(course: Course): Promise<void> {
    if (!this.user) {
      this.error = 'Please sign in first';
      return;
    }
    try {
      await this.courseService.enrollLearner(course.id!, this.user.uid);
      const totalLessons = course.totalLessons || 5;
      await this.courseService.createProgress({
        courseId: course.id!,
        learnerId: this.user.uid,
        completedLessons: 0,
        totalLessons,
        updatedAt: new Date().toISOString()
      });
      this.success = 'Enrolled successfully';
      this.loadCourses();
    } catch (err: any) {
      this.error = err?.message ?? 'Enrollment failed';
    }
  }

  get filteredCourses(): Course[] {
    const term = this.search.toLowerCase();
    return this.courses.filter((course) => {
      const matchesTitle = course.title.toLowerCase().includes(term);
      return matchesTitle;
    });
  }

  get enrolledCourses(): Course[] {
    return this.myProgress
      .map((progress) => this.courses.find((course) => course.id === progress.courseId))
      .filter((course): course is Course => !!course)
      .sort((a, b) => {
        const progressA = this.progressByCourse[a.id!]?.completedLessons || 0;
        const progressB = this.progressByCourse[b.id!]?.completedLessons || 0;
        return progressB - progressA;
      });
  }

  getRemainingSeats(course: Course): number {
    const enrollments = this.enrollmentsByCourse[course.id!] ?? [];
    return course.seats - enrollments.length;
  }

  isCourseFull(course: Course): boolean {
    return this.getRemainingSeats(course) <= 0;
  }

  getProgressPercent(): number {
    if (!this.selectedProgress) {
      return 0;
    }
    return Math.round((this.selectedProgress.completedLessons / this.selectedProgress.totalLessons) * 100);
  }

  getProgressLabel(): string {
    if (!this.selectedProgress) {
      return 'Not started';
    }
    const percent = this.getProgressPercent();
    return percent >= 100 ? 'Completed' : `${percent}% complete`;
  }

  getProgressPercentForCourse(course: Course): number {
    const progress = course.id ? this.progressByCourse[course.id] : null;
    if (!progress) {
      return 0;
    }
    return Math.round((progress.completedLessons / progress.totalLessons) * 100);
  }

  async completeLesson(course: Course): Promise<void> {
    if (!this.user || !this.selectedProgress) {
      return;
    }
    const totalLessons = this.selectedProgress.totalLessons;
    await this.courseService.completeLesson(course.id!, this.user.uid, totalLessons);
    this.showToast('Lesson completed. Progress updated.', 'success');
    if (course.id && this.progressByCourse[course.id]) {
      this.selectedProgress = {
        ...this.selectedProgress,
        completedLessons: Math.min(this.selectedProgress.completedLessons + 1, totalLessons),
        updatedAt: new Date().toISOString()
      };
      this.progressByCourse[course.id] = this.selectedProgress;
      this.myProgress = this.myProgress.map((progress) =>
        progress.courseId === course.id ? this.selectedProgress! : progress
      );
    }
  }
}
