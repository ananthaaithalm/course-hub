import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CourseService } from './course.service';
import { Course, Enrollment, AppUser } from './models';

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
  user: AppUser | null = null;
  authMode: 'signin' | 'signup' = 'signin';
  email = '';
  password = '';
  search = '';
  showOnlyOpen = false;

  editingCourse: Course | null = null;
  formCourse: Partial<Course> = {};

  loading = false;
  error = '';
  success = '';

  ngOnInit(): void {
    this.courseService.authState().subscribe((user) => {
      this.loading = true;
      this.courseService.getUserRole(user).subscribe((role) => {
        this.user = role;
        this.loading = false;
        if (role) {
          this.loadCourses();
        }
      });
    });
  }

  async signIn(): Promise<void> {
    this.error = '';
    this.success = '';
    try {
      await this.courseService.signIn(this.email, this.password);
      this.success = 'Signed in successfully';
    } catch (err: any) {
      this.error = err?.message ?? 'Unable to sign in';
    }
  }

  async signUp(): Promise<void> {
    this.error = '';
    this.success = '';
    try {
      await this.courseService.signUp(this.email, this.password);
      this.success = 'Account created';
    } catch (err: any) {
      this.error = err?.message ?? 'Unable to create account';
    }
  }

  async signOut(): Promise<void> {
    await this.courseService.signOutUser();
    this.user = null;
    this.courses = [];
    this.enrollmentsByCourse = {};
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
      const openSeats = this.getRemainingSeats(course) > 0;
      return matchesTitle && (!this.showOnlyOpen || openSeats);
    });
  }

  getRemainingSeats(course: Course): number {
    const enrollments = this.enrollmentsByCourse[course.id!] ?? [];
    return course.seats - enrollments.length;
  }

  isCourseFull(course: Course): boolean {
    return this.getRemainingSeats(course) <= 0;
  }
}
