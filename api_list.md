# API Curl Commands List (Ultimate)

This file contains **every single endpoint** for the **Auth**, **Course**, and **Event** modules (including both Admin and Application APIs).

**Base URL:** `http://localhost:3000`

---

## 1. Auth Module (`/auth`)

### Get Current User Details

```bash
curl -X GET "http://localhost:3000/auth/me"
```

### Register User

```bash
curl -X POST "http://localhost:3000/auth/register" \
     -H "Content-Type: application/json" \
     -d '{
           "email": "user@example.com",
           "password": "password123",
           "type": "user"
         }'
```

### Login User

```bash
curl -X POST "http://localhost:3000/auth/login" \
     -H "Content-Type: application/json" \
     -d '{
           "email": "user@example.com",
           "password": "password123"
         }'
```

### Refresh Token

```bash
curl -X POST "http://localhost:3000/auth/refresh-token" \
     -H "Content-Type: application/json" \
     -d '{ "refresh_token": "YOUR_REFRESH_TOKEN" }'
```

### Logout

```bash
curl -X POST "http://localhost:3000/auth/logout"
```

### Google Login

```bash
curl -X GET "http://localhost:3000/auth/google"
```

### Google Login Redirect

```bash
curl -X GET "http://localhost:3000/auth/google/redirect"
```

### Facebook Login

```bash
curl -X GET "http://localhost:3000/auth/facebook"
```

### Facebook Login Redirect

```bash
curl -X GET "http://localhost:3000/auth/facebook/redirect"
```

### Update User Profile (Multipart)

```bash
curl -X PATCH "http://localhost:3000/auth/update" \
     -F "name=John Doe" \
     -F "username=johndoe" \
     -F "phone_number=+1234567890" \
     -F "date_of_birth=2001-11-14" \
     -F "experience=Intermediate" \
     -F "about=I am an actor" \
     -F "avatar=@/path/to/avatar.jpg" \
     -F "cover_image=@/path/to/cover.jpg"
```

### Forgot Password

```bash
curl -X POST "http://localhost:3000/auth/forgot-password" \
     -H "Content-Type: application/json" \
     -d '{ "email": "user@example.com" }'
```

### Verify Email (OTP)

```bash
curl -X POST "http://localhost:3000/auth/verify-email" \
     -H "Content-Type: application/json" \
     -d '{
           "email": "user@example.com",
           "otp": "123456"
         }'
```

### Resend Verification Email

```bash
curl -X POST "http://localhost:3000/auth/resend-verification-email" \
     -H "Content-Type: application/json" \
     -d '{ "email": "user@example.com" }'
```

### Reset Password

```bash
curl -X POST "http://localhost:3000/auth/reset-password" \
     -H "Content-Type: application/json" \
     -d '{
           "email": "user@example.com",
           "otp": "123456",
           "new_password": "newpassword123"
         }'
```

### Change Password

```bash
curl -X POST "http://localhost:3000/auth/change-password" \
     -H "Content-Type: application/json" \
     -d '{
           "old_password": "oldpassword123",
           "new_password": "newpassword123"
         }'
```

### Request Email Change

```bash
curl -X POST "http://localhost:3000/auth/request-email-change" \
     -H "Content-Type: application/json" \
     -d '{ "email": "newemail@example.com" }'
```

### Change Email (Confirm with Token)

```bash
curl -X POST "http://localhost:3000/auth/change-email" \
     -H "Content-Type: application/json" \
     -d '{
           "email": "newemail@example.com",
           "token": "verification_token"
         }'
```

### 2FA - Generate Secret

```bash
curl -X POST "http://localhost:3000/auth/generate-2fa-secret"
```

### 2FA - Verify

```bash
curl -X POST "http://localhost:3000/auth/verify-2fa" \
     -H "Content-Type: application/json" \
     -d '{ "token": "123456" }'
```

### 2FA - Enable

```bash
curl -X POST "http://localhost:3000/auth/enable-2fa"
```

### 2FA - Disable

```bash
curl -X POST "http://localhost:3000/auth/disable-2fa"
```

---

## 2. Course Module

### A. Application side (`/courses`)

#### Get All Courses

_Query: `my_courses` (boolean)_

```bash
curl -X GET "http://localhost:3000/courses?my_courses=false"
```

#### Get Course Details

```bash
curl -X GET "http://localhost:3000/courses/:course_id"
```

#### Get My Assignments for Course

```bash
curl -X GET "http://localhost:3000/courses/:course_id/assignments"
```

#### Get Course Assets

_Query: `type` (VIDEO | FILE)_

```bash
curl -X GET "http://localhost:3000/courses/:course_id/assets?type=VIDEO"
```

#### Get Module Details

```bash
curl -X GET "http://localhost:3000/courses/modules/:module_id"
```

#### Get Class Details

```bash
curl -X GET "http://localhost:3000/courses/modules/classes/:class_id"
```

#### Get Assignment Details

```bash
curl -X GET "http://localhost:3000/courses/modules/classes/assignments/:assignment_id"
```

#### Get All Assignments for a Class

```bash
curl -X GET "http://localhost:3000/courses/modules/classes/:class_id/assignments"
```

#### Submit Assignment (Multipart)

```bash
curl -X POST "http://localhost:3000/courses/modules/classes/assignments/:assignment_id" \
     -F "title=Submission Title" \
     -F "description=Submission Description" \
     -F "attachments=@/path/to/file.zip"
```

#### Get All Assets for a Class

```bash
curl -X GET "http://localhost:3000/courses/modules/classes/:class_id/assets"
```

#### Get Enrollment Current Step

```bash
curl -X GET "http://localhost:3000/courses/:course_id/enrollment/current_step"
```

#### Enroll in Course

```bash
curl -X POST "http://localhost:3000/courses/:course_id/enrollment" \
     -H "Content-Type: application/json" \
     -d '{
           "step": "FORM_FILLING",
           "name": "John Doe",
           "email": "john@example.com",
           "phone": "+123456789",
           "address": "NY",
           "date_of_birth": "2000-01-01"
         }'
```

#### Scan Attendance QR

```bash
curl -X POST "http://localhost:3000/courses/attendance/scan-qr" \
     -H "Content-Type: application/json" \
     -d '{ "token": "QR_TOKEN" }'
```

### B. Admin side (`/admin/courses`)

#### Generate Attendance QR

```bash
curl -X POST "http://localhost:3000/admin/courses/attendance/generate-qr/:classId"
```

#### Get All Attendance (Admin)

_Query: `status`, `date`, `classId`, `courseId`, `search`, `page`, `limit`_

```bash
curl -X GET "http://localhost:3000/admin/courses/attendance?status=PRESENT"
```

#### Mark Manual Attendance

```bash
curl -X POST "http://localhost:3000/admin/courses/attendance/manual" \
     -H "Content-Type: application/json" \
     -d '{
           "classId": "class_id_here",
           "studentId": "student_id_here",
           "status": "PRESENT"
         }'
```

#### Create Course

```bash
curl -X POST "http://localhost:3000/admin/courses" \
     -H "Content-Type: application/json" \
     -d '{
           "title": "Acting Mastery",
           "course_overview": "Comprehensive Acting Course",
           "duration": 120,
           "start_date": "2027-01-01",
           "class_time": "18:00",
           "fee_pence": 20000,
           "installment_process": "3 months",
           "seat_capacity": 25,
           "contract": "Terms text",
           "rules_regulations": "Rules text"
         }'
```

#### Get All Courses (Admin)

_Query: `search`, `page`, `limit`, `status`_

```bash
curl -X GET "http://localhost:3000/admin/courses?status=ACTIVE"
```

#### Get Course by ID (Admin)

```bash
curl -X GET "http://localhost:3000/admin/courses/:course_id"
```

#### Update Course (Admin)

```bash
curl -X PATCH "http://localhost:3000/admin/courses/:course_id" \
     -H "Content-Type: application/json" \
     -d '{ "title": "Updated Course Title" }'
```

#### Delete Course (Admin)

```bash
curl -X DELETE "http://localhost:3000/admin/courses/:course_id"
```

#### Add Module to Course

```bash
curl -X POST "http://localhost:3000/admin/courses/:course_id/modules" \
     -H "Content-Type: application/json" \
     -d '{
           "module_name": "Module 1",
           "module_title": "Voice Acting",
           "module_overview": "Voice modulation"
         }'
```

#### Get All Modules for Course (Admin)

```bash
curl -X GET "http://localhost:3000/admin/courses/:course_id/modules"
```

#### Get Module by ID (Admin)

```bash
curl -X GET "http://localhost:3000/admin/courses/modules/:module_id"
```

#### Update Module (Admin)

```bash
curl -X PATCH "http://localhost:3000/admin/courses/modules/:module_id" \
     -H "Content-Type: application/json" \
     -d '{ "module_name": "New Module Name" }'
```

#### Delete Module (Admin)

```bash
curl -X DELETE "http://localhost:3000/admin/courses/modules/:module_id"
```

#### Add Class to Module

```bash
curl -X POST "http://localhost:3000/admin/courses/modules/:module_id/classes" \
     -H "Content-Type: application/json" \
     -d '{
           "class_title": "Class 1",
           "class_name": "Breathing",
           "duration": 60,
           "class_date": "2027-01-15",
           "class_time": "10:00"
         }'
```

#### Get All Classes for Module (Admin)

```bash
curl -X GET "http://localhost:3000/admin/courses/modules/:module_id/classes"
```

#### Get Class by ID (Admin)

```bash
curl -X GET "http://localhost:3000/admin/courses/modules/classes/:class_id"
```

#### Update Class (Admin)

```bash
curl -X PATCH "http://localhost:3000/admin/courses/modules/classes/:class_id" \
     -H "Content-Type: application/json" \
     -d '{ "class_title": "New Class Title" }'
```

#### Delete Class (Admin)

```bash
curl -X DELETE "http://localhost:3000/admin/courses/modules/classes/:class_id"
```

#### Create Assignment (Admin - Multipart)

```bash
curl -X POST "http://localhost:3000/admin/courses/modules/classes/:class_id/assignments" \
     -F "title=Homework 1" \
     -F "description=Practice voice" \
     -F "submission_date=2027-02-01" \
     -F "total_marks=100" \
     -F "attachments=@/path/to/file.pdf"
```

#### Get All Assignments for Class (Admin)

```bash
curl -X GET "http://localhost:3000/admin/courses/modules/classes/:class_id/assignments"
```

#### Get Assignment by ID (Admin)

```bash
curl -X GET "http://localhost:3000/admin/courses/modules/classes/assignments/:assignment_id"
```

#### Update Assignment (Admin - Multipart)

```bash
curl -X PATCH "http://localhost:3000/admin/courses/modules/classes/assignments/:assignment_id" \
     -F "title=Updated Assignment Title"
```

#### Delete Assignment (Admin)

```bash
curl -X DELETE "http://localhost:3000/admin/courses/modules/classes/assignments/:assignment_id"
```

#### Get All Submissions for Assignment (Admin)

_Query: `search`, `page`, `limit`, `status`_

```bash
curl -X GET "http://localhost:3000/admin/courses/modules/classes/assignments/:assignment_id/submissions"
```

#### Grade Submission (Admin)

```bash
curl -X POST "http://localhost:3000/admin/courses/modules/classes/assignments/submissions/:submission_id/grade" \
     -H "Content-Type: application/json" \
     -d '{
           "grade": "A+",
           "feedback": "Perfect!",
           "grade_number": 100
         }'
```

#### Upload Class Assets (Admin - Multipart)

```bash
curl -X POST "http://localhost:3000/admin/courses/modules/classes/:class_id/assets" \
     -F "attachments=@/path/to/file.mp4"
```

#### Get All Assets for a Class (Admin)

```bash
curl -X GET "http://localhost:3000/admin/courses/modules/classes/:class_id/assets"
```

#### Delete Class Asset (Admin)

```bash
curl -X DELETE "http://localhost:3000/admin/courses/modules/classes/assets/:asset_id"
```

---

## 3. Event Module

### A. Application side (`/events`)

#### Get All Events

```bash
curl -X GET "http://localhost:3000/events"
```

#### Get Event Details

```bash
curl -X GET "http://localhost:3000/events/:event_id"
```

### B. Admin side (`/admin/events`)

#### Get All Events (Admin)

_Query: `search`, `page`, `limit`, `status`_

```bash
curl -X GET "http://localhost:3000/admin/events?status=UPCOMING"
```

#### Get Event by ID (Admin)

```bash
curl -X GET "http://localhost:3000/admin/events/:event_id"
```

#### Create Event (Admin)

```bash
curl -X POST "http://localhost:3000/admin/events" \
     -H "Content-Type: application/json" \
     -d '{
           "name": "Drama Workshop",
           "start_at": "2026-10-01",
           "time": "15:00",
           "location": "Theater Hall",
           "amount": 50.0,
           "description": "Workshop details",
           "overview": "Overview text"
         }'
```

#### Update Event (Admin)

```bash
curl -X PATCH "http://localhost:3000/admin/events/:event_id" \
     -H "Content-Type: application/json" \
     -d '{ "name": "Updated Workshop Name" }'
```

---

## 4. User Management (Admin)

### Create User (Admin)

```bash
curl -X POST "http://localhost:3000/" \
     -H "Content-Type: application/json" \
     -d '{
           "name": "New User",
           "email": "user@example.com",
           "password": "password123",
           "type": "student"
         }'
```

### Get All Users (Admin)

_Query: `q` (search), `type` (role), `approved` (true/false)_

```bash
curl -X GET "http://localhost:3000/?type=student&approved=true"
```

#### Get User by ID (Admin)

```bash
curl -X GET "http://localhost:3000/:id"
```

#### Update User (Admin)

```bash
curl -X PATCH "http://localhost:3000/:id" \
     -H "Content-Type: application/json" \
     -d '{ "name": "Updated Name" }'
```

#### Delete User (Admin)

```bash
curl -X DELETE "http://localhost:3000/:id"
```

### Approve User (Admin)

```bash
curl -X POST "http://localhost:3000/:id/approve"
```

### Reject User (Admin)

```bash
curl -X POST "http://localhost:3000/:id/reject"
```

### Assign Role to User (Admin)

```bash
curl -X POST "http://localhost:3000/:id/assign-role" \
     -H "Content-Type: application/json" \
     -d '{ "role": "TEACHER" }'
```

### Get All Instructors (Short List)

```bash
curl -X GET "http://localhost:3000/instructors/all"
```

### Get All Students (Short List)

```bash
curl -X GET "http://localhost:3000/students/all"
```

### Get All Admins (Short List)

```bash
curl -X GET "http://localhost:3000/admins/all"
```

### Manage Instructors (Admin Detailed)

_Query: `search`, `status`, `page`, `limit`, `teacherId`, `includeClasses`_

```bash
curl -X GET "http://localhost:3000/admin/instructors?status=ACTIVE"
```

### Add Instructor (Admin Detailed)

```bash
curl -X POST "http://localhost:3000/admin/instructors" \
     -H "Content-Type: application/json" \
     -d '{
           "name": "Professor X",
           "email": "profx@example.com",
           "phone_number": "555-0199",
           "experienceLevel": "ADVANCED"
         }'
```

### Instructor Details (Admin Detailed)

```bash
curl -X GET "http://localhost:3000/admin/instructors/details/:id"
```

### Update Instructor (Admin Detailed)

```bash
curl -X PATCH "http://localhost:3000/admin/instructors/update/:id" \
     -H "Content-Type: application/json" \
     -d '{ "name": "Professor Charles Xavier" }'
```

### Manual Student Enrollment (Admin - Multipart)

```bash
curl -X POST "http://localhost:3000/admin/student-management/manual-enrollment" \
     -F "courseId=course_id_here" \
     -F "full_name=Student Name" \
     -F "email=student@example.com" \
     -F "phone=123456789" \
     -F "address=NY" \
     -F "experience_level=BEGINNER" \
     -F "acting_goals=Goals" \
     -F "transaction_id=TXN_001" \
     -F "amount=150" \
     -F "rules_signing=@/path/to/rules.pdf" \
     -F "contract_signing=@/path/to/contract.pdf"
```

### Get Student Profile (Admin Detailed)

```bash
curl -X GET "http://localhost:3000/admin/student-management/student/:studentId"
```

### Managed Students List (Admin Detailed)

_Query: `page`, `limit`, `search`, `status`, `experienceLevel`, `paymentStatus`, `courseId`_

```bash
curl -X GET "http://localhost:3000/admin/student-management?courseId=id_here"
```

### Update Enrollment Info (Admin Detailed)

```bash
curl -X PATCH "http://localhost:3000/admin/student-management/enrollment/:enrollmentId" \
     -H "Content-Type: application/json" \
     -d '{ "status": "ACTIVE" }'
```

### Restrict Student Access (Admin Detailed)

```bash
curl -X PATCH "http://localhost:3000/admin/student-management/enrollment/:enrollmentId/restrict" \
     -H "Content-Type: application/json" \
     -d '{ "restricted": true }'
```
