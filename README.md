# CourseHub

CourseHub is a simple Angular + Firebase training enrolment dashboard for coordinators and learners.

## Features
- Firebase Auth sign-in with separate coordinator and learner views
- Create, edit, and delete courses
- Enrol learners into courses with seat limits enforced
- Live dashboard from Firestore with search and open-seat filtering

## Demo login
- Coordinator: coordinator@coursehub.com / password123

## Local development
1. Install dependencies: npm install
2. Start the app: npm start
3. Open http://localhost:4200

## Firebase setup
This project uses Firestore and Firebase Auth. Update the values in src/app/firebase-config.ts with your own Firebase project configuration before deploying.
