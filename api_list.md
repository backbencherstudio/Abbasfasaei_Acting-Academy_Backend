# API Curl List

- Base URL: `http://localhost:7777`
- Skipped modules: none
- Note: `transaction` module include kora hoyeche, karon eta alada module
- Sync status: `2026-05-31` e `src/app.controller.ts` ebong `src/modules/**/**.controller.ts` er route-gular shathe verify kora hoyeche; ei snapshot-e kono endpoint missing paoa jayni

---

<details>
<summary>App Module</summary>

### Root Health Check

```bash
curl -X GET "http://localhost:7777/"
```

### Test Chunk Stream

```bash
curl -X GET "http://localhost:7777/test-chunk-stream"
```

### Test File Stream

```bash
curl -X GET "http://localhost:7777/test-file-stream"
```

### Test File Upload

```bash
curl -X POST "http://localhost:7777/test-file-upload" \
  -F "image=@/path/to/image.jpg"
```

---

</details>

<details>
<summary>Auth Module</summary>

### Get Current User

```bash
curl -X GET "http://localhost:7777/auth/me"
```

### Register

```bash
curl -X POST "http://localhost:7777/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "type": "user"
  }'
```

### Login

```bash
curl -X POST "http://localhost:7777/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

### Refresh Token

```bash
curl -X POST "http://localhost:7777/auth/refresh-token" \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token": "YOUR_REFRESH_TOKEN"
  }'
```

### Logout

```bash
curl -X POST "http://localhost:7777/auth/logout"
```

### Google Login

```bash
curl -X GET "http://localhost:7777/auth/google"
```

### Google Redirect

```bash
curl -X GET "http://localhost:7777/auth/google/redirect"
```

### Facebook Login

```bash
curl -X GET "http://localhost:7777/auth/facebook"
```

### Facebook Redirect

```bash
curl -X GET "http://localhost:7777/auth/facebook/redirect"
```

### Update User

```bash
curl -X PATCH "http://localhost:7777/auth/update" \
  -F "name=John Doe" \
  -F "username=johndoe" \
  -F "phone_number=+8801712345678" \
  -F "date_of_birth=2001-11-14" \
  -F "experience=Intermediate" \
  -F "about=I am an actor" \
  -F "avatar=@/path/to/avatar.jpg" \
  -F "cover_image=@/path/to/cover.jpg"
```

### Forgot Password

```bash
curl -X POST "http://localhost:7777/auth/forgot-password" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com"
  }'
```

### Verify Email

```bash
curl -X POST "http://localhost:7777/auth/verify-email" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "otp": "123456"
  }'
```

### Resend Verification Email

```bash
curl -X POST "http://localhost:7777/auth/resend-verification-email" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com"
  }'
```

### Reset Password

```bash
curl -X POST "http://localhost:7777/auth/reset-password" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "otp": "123456",
    "new_password": "newpassword123"
  }'
```

### Change Password

```bash
curl -X POST "http://localhost:7777/auth/change-password" \
  -H "Content-Type: application/json" \
  -d '{
    "old_password": "oldpassword123",
    "new_password": "newpassword123"
  }'
```

### Request Email Change

```bash
curl -X POST "http://localhost:7777/auth/request-email-change" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newemail@example.com"
  }'
```

### Change Email

```bash
curl -X POST "http://localhost:7777/auth/change-email" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newemail@example.com",
    "token": "verification_token"
  }'
```

### Generate 2FA Secret

```bash
curl -X POST "http://localhost:7777/auth/generate-2fa-secret"
```

### Verify 2FA

```bash
curl -X POST "http://localhost:7777/auth/verify-2fa" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "123456"
  }'
```

### Enable 2FA

```bash
curl -X POST "http://localhost:7777/auth/enable-2fa"
```

### Disable 2FA

```bash
curl -X POST "http://localhost:7777/auth/disable-2fa"
```

---

</details>

<details>
<summary>Application Profile Module</summary>

### Get Profile

```bash
curl -X GET "http://localhost:7777/profile"
```

### Get Personal Info

```bash
curl -X GET "http://localhost:7777/profile/personal-info"
```

### Update Personal Info

```bash
curl -X PUT "http://localhost:7777/profile/personal-info" \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "John Doe",
    "phone": "+8801712345678",
    "dateOfBirth": "2000-01-01T00:00:00.000Z",
    "experienceLevel": "BEGINNER",
    "about": "About me",
    "address": {
      "country": "Bangladesh",
      "city": "Dhaka",
      "address": "House 10, Road 2"
    }
  }'
```

### Disable Account

```bash
curl -X PUT "http://localhost:7777/profile/disable-account"
```

### Delete Account

```bash
curl -X DELETE "http://localhost:7777/profile/delete-account"
```

### Activate Account

```bash
curl -X PUT "http://localhost:7777/profile/activate-account"
```

### Profile Logout

```bash
curl -X POST "http://localhost:7777/profile/logout"
```

---

</details>

<details>
<summary>Application Overview Module</summary>

### Get Student Overview

```bash
curl -X GET "http://localhost:7777/overview"
```

---

</details>

<details>
<summary>Application Contact Module</summary>

### Create Contact

```bash
curl -X POST "http://localhost:7777/contact" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@example.com",
    "phone_number": "+1234567890",
    "message": "Hello, I have a question."
  }'
```

---

</details>

<details>
<summary>Application FAQ Module</summary>

### Get All FAQ

```bash
curl -X GET "http://localhost:7777/faq"
```

### Get FAQ By ID

```bash
curl -X GET "http://localhost:7777/faq/:id"
```

---

</details>

<details>
<summary>Application Event Module</summary>

### Get All Events

```bash
curl -X GET "http://localhost:7777/events"
```

### Get Event By ID

```bash
curl -X GET "http://localhost:7777/events/:event_id"
```

---

</details>

<details>
<summary>Application Course Module</summary>

### Get All Courses

```bash
curl -X GET "http://localhost:7777/courses?my_courses=false"
```

### Get Course Details

```bash
curl -X GET "http://localhost:7777/courses/:course_id"
```

### Get Course Assignments

```bash
curl -X GET "http://localhost:7777/courses/:course_id/assignments"
```

### Get Course Assets

```bash
curl -X GET "http://localhost:7777/courses/:course_id/assets?type=VIDEO"
```

### Get Module Details

```bash
curl -X GET "http://localhost:7777/courses/modules/:module_id"
```

### Get Class Details

```bash
curl -X GET "http://localhost:7777/courses/modules/classes/:class_id"
```

### Get Assignment Details

```bash
curl -X GET "http://localhost:7777/courses/modules/classes/assignments/:assignment_id"
```

### Get Class Assignments

```bash
curl -X GET "http://localhost:7777/courses/modules/classes/:class_id/assignments"
```

### Submit Assignment

```bash
curl -X POST "http://localhost:7777/courses/modules/classes/assignments/:assignment_id" \
  -F "title=Submission Title" \
  -F "description=Submission Description" \
  -F "fileUrl=https://example.com/submission.pdf" \
  -F "attachments=@/path/to/file.pdf"
```

### Get Class Assets

```bash
curl -X GET "http://localhost:7777/courses/modules/classes/:class_id/assets"
```

### Get Enrollment Current Step

```bash
curl -X GET "http://localhost:7777/courses/:course_id/enrollment/current_step"
```

### Enroll User - Form Filling

```bash
curl -X POST "http://localhost:7777/courses/:course_id/enrollment" \
  -H "Content-Type: application/json" \
  -d '{
    "step": "FORM_FILLING",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+8801712345678",
    "address": "Dhaka",
    "date_of_birth": "2000-01-01",
    "experience": "BEGINNER",
    "acting_goals": "Improve acting"
  }'
```

### Enroll User - Rules Signing

```bash
curl -X POST "http://localhost:7777/courses/:course_id/enrollment" \
  -H "Content-Type: application/json" \
  -d '{
    "step": "RULES_SIGNING",
    "rules_accepted": true,
    "signature_full_name": "John Doe",
    "signature": "John Doe",
    "signature_date": "2026-05-17"
  }'
```

### Enroll User - Contract Signing

```bash
curl -X POST "http://localhost:7777/courses/:course_id/enrollment" \
  -H "Content-Type: application/json" \
  -d '{
    "step": "CONTRACT_SIGNING",
    "terms_accepted": true,
    "signature_full_name": "John Doe",
    "signature": "John Doe",
    "signature_date": "2026-05-17"
  }'
```

### Scan Attendance QR

```bash
curl -X POST "http://localhost:7777/courses/attendance/scan-qr" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "QR_TOKEN"
  }'
```

---

</details>

<details>
<summary>Application Community Module</summary>

### Create Post

```bash
curl -X POST "http://localhost:7777/community/post" \
  -F "post_type=POST" \
  -F "content=This is my first post" \
  -F "visibility=PUBLIC" \
  -F "attachments=@/path/to/file.jpg"
```

### Create Poll Post

```bash
curl -X POST "http://localhost:7777/community/post" \
  -F "post_type=POLL" \
  -F "content=Which class do you like?" \
  -F "poll_options=Option 1" \
  -F "poll_options=Option 2" \
  -F "visibility=PUBLIC"
```

### Update Post

```bash
curl -X PATCH "http://localhost:7777/community/post/:post_id" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Updated post content",
    "visibility": "PUBLIC"
  }'
```

### Get Community Feed

```bash
curl -X GET "http://localhost:7777/community/feed?search=hello&cursor=CURSOR_VALUE&limit=10"
```

### Get Post Allowed List

```bash
curl -X GET "http://localhost:7777/community/post/:post_id/allowed_list"
```

### Delete Post

```bash
curl -X DELETE "http://localhost:7777/community/post/:post_id"
```

### Get Post Likes

```bash
curl -X GET "http://localhost:7777/community/posts/:post_id/likes?cursor=CURSOR_VALUE&limit=10"
```

### Like Post

```bash
curl -X POST "http://localhost:7777/community/posts/:post_id/like"
```

### Vote On Poll

```bash
curl -X PATCH "http://localhost:7777/community/post/:post_id/vote/:option_id"
```

### Comment On Post

```bash
curl -X POST "http://localhost:7777/community/post/:post_id/comment" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Nice post",
    "comment_id": "OPTIONAL_PARENT_COMMENT_ID"
  }'
```

### Get Post Comments

```bash
curl -X GET "http://localhost:7777/community/post/:post_id/comments"
```

### Like Comment

```bash
curl -X POST "http://localhost:7777/community/posts/comments/:comment_id/like"
```

### Delete Comment

```bash
curl -X PATCH "http://localhost:7777/community/posts/comments/:comment_id/delete"
```

### Share Post

```bash
curl -X POST "http://localhost:7777/community/posts/:post_id/share" \
  -H "Content-Type: application/json" \
  -d '{
    "medium": "facebook"
  }'
```

### Get User Profile

```bash
curl -X GET "http://localhost:7777/community/profile/:user_id"
```

### Report User

```bash
curl -X POST "http://localhost:7777/community/report/:reported_user_id" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "spam",
    "description": "Detailed reason"
  }'
```

---

</details>

<details>
<summary>Admin Overview Module</summary>

### Get Admin Overview

```bash
curl -X GET "http://localhost:7777/admin/overview"
```

---

</details>

<details>
<summary>Admin User Module</summary>

### Create User

```bash
curl -X POST "http://localhost:7777/admin/users" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "1234567890",
    "password": "password123",
    "type": "student",
    "join_date": "2026-01-01",
    "experience": "2 years"
  }'
```

### Get All Users

```bash
curl -X GET "http://localhost:7777/admin/users?search=john&type=STUDENT&page=1&limit=10&status=ACTIVE"
```

### Approve User

```bash
curl -X POST "http://localhost:7777/admin/users/:user_id/approve"
```

### Reject User

```bash
curl -X POST "http://localhost:7777/admin/users/:user_id/reject"
```

### Get User By ID

```bash
curl -X GET "http://localhost:7777/admin/users/:user_id"
```

### Update User

```bash
curl -X PATCH "http://localhost:7777/admin/users/:user_id" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Name",
    "phone": "01999999999"
  }'
```

### Update User Status

```bash
curl -X PATCH "http://localhost:7777/admin/users/:user_id/status" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "BLOCKED"
  }'
```

### Delete User

```bash
curl -X DELETE "http://localhost:7777/admin/users/:user_id"
```

---

</details>

<details>
<summary>Admin Settings Module</summary>

### Get General Settings

```bash
curl -X GET "http://localhost:7777/admin/settings/general-settings"
```

### Update General Settings

```bash
curl -X POST "http://localhost:7777/admin/settings/general-settings" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Website Name",
    "phone_number": "+8801712345678",
    "email": "info@example.com",
    "address": "Dhaka"
  }'
```

### Get Profile Settings

```bash
curl -X GET "http://localhost:7777/admin/settings/profile-settings"
```

### Update Profile Settings

```bash
curl -X POST "http://localhost:7777/admin/settings/update-profile" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "currentPassword": "oldpass",
    "newPassword": "newpass123",
    "confirmNewPassword": "newpass123"
  }'
```

---

</details>

<details>
<summary>Admin Website Info Module</summary>

### Update Website Info

```bash
curl -X POST "http://localhost:7777/admin/website-info" \
  -F "name=My Website" \
  -F "phone_number=081234567890" \
  -F "email=mywebsite@gmail.com" \
  -F "address=Dhaka" \
  -F "copyright=© 2025 My Website" \
  -F "cancellation_policy=No refund after enrollment" \
  -F "logo=@/path/to/logo.png" \
  -F "favicon=@/path/to/favicon.ico"
```

### Get Website Info

```bash
curl -X GET "http://localhost:7777/admin/website-info"
```

---

</details>

<details>
<summary>Admin Contact Module</summary>

### Create Contact

```bash
curl -X POST "http://localhost:7777/admin/contact" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@example.com",
    "phone_number": "+1234567890",
    "message": "Hello"
  }'
```

### Get All Contacts

```bash
curl -X GET "http://localhost:7777/admin/contact?q=john&status=1"
```

### Get Contact By ID

```bash
curl -X GET "http://localhost:7777/admin/contact/:id"
```

### Update Contact

```bash
curl -X PATCH "http://localhost:7777/admin/contact/:id" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Updated message"
  }'
```

### Delete Contact

```bash
curl -X DELETE "http://localhost:7777/admin/contact/:id"
```

---

</details>

<details>
<summary>Admin FAQ Module</summary>

### Create FAQ

```bash
curl -X POST "http://localhost:7777/admin/faq" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is the fee?",
    "answer": "1000 BDT",
    "sort_order": 1
  }'
```

### Batch Create FAQ

```bash
curl -X POST "http://localhost:7777/admin/faq/batch-create" \
  -H "Content-Type: application/json" \
  -d '{
    "faqs": [
      {
        "question": "What is the fee?",
        "answer": "1000 BDT",
        "sort_order": 1
      }
    ]
  }'
```

### Get All FAQ

```bash
curl -X GET "http://localhost:7777/admin/faq"
```

### Get FAQ By ID

```bash
curl -X GET "http://localhost:7777/admin/faq/:id"
```

### Update FAQ

```bash
curl -X PATCH "http://localhost:7777/admin/faq/:id" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Updated question",
    "answer": "Updated answer"
  }'
```

### Delete FAQ

```bash
curl -X DELETE "http://localhost:7777/admin/faq/:id"
```

---

</details>

<details>
<summary>Admin Event Module</summary>

### Get All Events

```bash
curl -X GET "http://localhost:7777/admin/events?search=hiphop&page=1&limit=10&status=UPCOMING"
```

### Get Event By ID

```bash
curl -X GET "http://localhost:7777/admin/events/:event_id"
```

### Get Event Members

```bash
curl -X GET "http://localhost:7777/admin/events/:event_id/members?search=john&page=1&limit=10&start_date=2026-01-01&end_date=2026-12-31"
```

### Create Event

```bash
curl -X POST "http://localhost:7777/admin/events" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Hip Hop Fest",
    "start_at": "2026-06-01",
    "time": "09:00",
    "location": "Auditorium",
    "amount": 25,
    "description": "Event description",
    "overview": "Long overview"
  }'
```

### Update Event

```bash
curl -X PATCH "http://localhost:7777/admin/events/:event_id" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Event Name",
    "location": "Updated Location"
  }'
```

---

</details>

<details>
<summary>Admin Course Module</summary>

Controller source: `src/modules/admin/course/courses.controller.ts`

### Generate Attendance QR

```bash
curl -X POST "http://localhost:7777/admin/courses/attendance/generate-qr/:classId"
```

### Get All Attendance

```bash
curl -X GET "http://localhost:7777/admin/courses/attendance?status=PRESENT&date=2026-05-17&classId=CLASS_ID&courseId=COURSE_ID&search=john&page=1&limit=10"
```

### Mark Manual Attendance

```bash
curl -X POST "http://localhost:7777/admin/courses/attendance/manual" \
  -H "Content-Type: application/json" \
  -d '{
    "classId": "CLASS_ID",
    "studentId": "STUDENT_ID",
    "status": "PRESENT",
    "attendedAt": "2026-05-17T10:00:00.000Z"
  }'
```

### Create Course

```bash
curl -X POST "http://localhost:7777/admin/courses" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Introduction to Acting",
    "course_overview": "Course Overview",
    "status": "ACTIVE",
    "duration": 100,
    "start_date": "2027-01-01",
    "class_time": "17:00",
    "instructor_id": "OPTIONAL_USER_ID",
    "fee_pence": 100,
    "installment_process": "3 installments",
    "seat_capacity": 30,
    "contract": "Terms text",
    "rules_regulations": "Rules text"
  }'
```

### Get All Courses

```bash
curl -X GET "http://localhost:7777/admin/courses?search=acting&page=1&limit=10&status=ACTIVE"
```

### Get All Courses - Teacher/Admin Basic

```bash
curl -X GET "http://localhost:7777/admin/courses"
```

### Get Courses By User ID

```bash
curl -X GET "http://localhost:7777/admin/courses/courses/users/:user_id"
```

### Get Course By ID

```bash
curl -X GET "http://localhost:7777/admin/courses/:course_id"
```

### Update Course

```bash
curl -X PATCH "http://localhost:7777/admin/courses/:course_id" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Course Title"
  }'
```

### Update Course - Full Example

```bash
curl -X PATCH "http://localhost:7777/admin/courses/:course_id" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Advanced Acting",
    "course_overview": "Updated course overview",
    "status": "ACTIVE",
    "duration": 120,
    "start_date": "2027-02-01",
    "class_time": "18:30",
    "instructor_id": "USER_ID",
    "fee_pence": 150,
    "installment_process": "2 installments",
    "seat_capacity": 35,
    "contract": "Updated terms",
    "rules_regulations": "Updated rules"
  }'
```

### Delete Course

```bash
curl -X DELETE "http://localhost:7777/admin/courses/:course_id"
```

### Add Module

```bash
curl -X POST "http://localhost:7777/admin/courses/:course_id/modules" \
  -H "Content-Type: application/json" \
  -d '{
    "module_name": "Module 1",
    "module_title": "Introduction",
    "module_overview": "Overview"
  }'
```

### Get All Modules

```bash
curl -X GET "http://localhost:7777/admin/courses/:course_id/modules"
```

### Get Module By ID

```bash
curl -X GET "http://localhost:7777/admin/courses/modules/:module_id"
```

### Update Module

```bash
curl -X PATCH "http://localhost:7777/admin/courses/modules/:module_id" \
  -H "Content-Type: application/json" \
  -d '{
    "module_title": "Updated Module Title"
  }'
```

### Update Module - Full Example

```bash
curl -X PATCH "http://localhost:7777/admin/courses/modules/:module_id" \
  -H "Content-Type: application/json" \
  -d '{
    "module_name": "Updated Module Name",
    "module_title": "Updated Module Title",
    "module_overview": "Updated module overview"
  }'
```

### Delete Module

```bash
curl -X DELETE "http://localhost:7777/admin/courses/modules/:module_id"
```

### Add Class

```bash
curl -X POST "http://localhost:7777/admin/courses/modules/:module_id/classes" \
  -H "Content-Type: application/json" \
  -d '{
    "class_title": "Class 1",
    "class_name": "Voice Training",
    "class_overview": "Overview",
    "duration": 60,
    "class_date": "2027-01-15",
    "class_time": "10:00"
  }'
```

### Get All Classes

```bash
curl -X GET "http://localhost:7777/admin/courses/modules/:module_id/classes"
```

### Get Class By ID

```bash
curl -X GET "http://localhost:7777/admin/courses/modules/classes/:class_id"
```

### Update Class

```bash
curl -X PATCH "http://localhost:7777/admin/courses/modules/classes/:class_id" \
  -H "Content-Type: application/json" \
  -d '{
    "class_title": "Updated Class Title"
  }'
```

### Update Class - Full Example

```bash
curl -X PATCH "http://localhost:7777/admin/courses/modules/classes/:class_id" \
  -H "Content-Type: application/json" \
  -d '{
    "class_title": "Updated Class Title",
    "class_name": "Updated Class Name",
    "class_overview": "Updated class overview",
    "duration": 90,
    "class_date": "2027-01-20",
    "class_time": "11:00"
  }'
```

### Delete Class

```bash
curl -X DELETE "http://localhost:7777/admin/courses/modules/classes/:class_id"
```

### Start Class

```bash
curl -X PATCH "http://localhost:7777/admin/courses/modules/classes/:class_id/start"
```

### End Class

```bash
curl -X PATCH "http://localhost:7777/admin/courses/modules/classes/:class_id/end"
```

### Create Assignment

```bash
curl -X POST "http://localhost:7777/admin/courses/modules/classes/:class_id/assignments" \
  -F "title=Homework 1" \
  -F "description=Practice scene" \
  -F "submission_date=2027-02-01" \
  -F "total_marks=100" \
  -F "attachments=@/path/to/file.pdf"
```

### Get All Assignments

```bash
curl -X GET "http://localhost:7777/admin/courses/modules/classes/:class_id/assignments"
```

### Get Assignment By ID

```bash
curl -X GET "http://localhost:7777/admin/courses/modules/classes/assignments/:assignment_id"
```

### Update Assignment

```bash
curl -X PATCH "http://localhost:7777/admin/courses/modules/classes/assignments/:assignment_id" \
  -F "title=Updated Assignment Title" \
  -F "description=Updated description" \
  -F "total_marks=80"
```

### Update Assignment - Full Example

```bash
curl -X PATCH "http://localhost:7777/admin/courses/modules/classes/assignments/:assignment_id" \
  -F "title=Updated Assignment Title" \
  -F "description=Updated assignment description" \
  -F "submission_date=2027-02-05" \
  -F "total_marks=80" \
  -F "attachments=@/path/to/updated-file.pdf"
```

### Delete Assignment

```bash
curl -X DELETE "http://localhost:7777/admin/courses/modules/classes/assignments/:assignment_id"
```

### Get Assignment Submissions

```bash
curl -X GET "http://localhost:7777/admin/courses/modules/classes/assignments/:assignment_id/submissions?search=john&page=1&limit=10&status=SUBMITTED"
```

### Grade Submission

```bash
curl -X POST "http://localhost:7777/admin/courses/modules/classes/assignments/submissions/:submission_id/grade" \
  -H "Content-Type: application/json" \
  -d '{
    "grade": "A+",
    "feedback": "Excellent work",
    "grade_number": 95
  }'
```

### Upload Class Assets

```bash
curl -X POST "http://localhost:7777/admin/courses/modules/classes/:class_id/assets" \
  -F "attachments=@/path/to/file1.pdf" \
  -F "attachments=@/path/to/file2.mp4"
```

### Upload Class Assets - Single File

```bash
curl -X POST "http://localhost:7777/admin/courses/modules/classes/:class_id/assets" \
  -F "attachments=@/path/to/file.pdf"
```

### Get Class Assets

```bash
curl -X GET "http://localhost:7777/admin/courses/modules/classes/:class_id/assets"
```

### Delete Class Asset

```bash
curl -X DELETE "http://localhost:7777/admin/courses/modules/classes/assets/:asset_id"
```

---

</details>

<details>
<summary>Admin Community Module</summary>

### Create Admin Post

```bash
curl -X POST "http://localhost:7777/admin/community" \
  -F "post_type=POST" \
  -F "content=Official admin announcement" \
  -F "attachments=@/path/to/file.jpg"
```

### Create Admin Poll Post

```bash
curl -X POST "http://localhost:7777/admin/community" \
  -F "post_type=POLL" \
  -F "content=Which batch suits you?" \
  -F "poll_options=Morning" \
  -F "poll_options=Evening"
```

### Get All Community Posts

```bash
curl -X GET "http://localhost:7777/admin/community/posts?search=hello&status=ACTIVE&role=STUDENT&page=1&limit=10"
```

### Get Community Post By ID

```bash
curl -X GET "http://localhost:7777/admin/community/posts/:post_id"
```

### Update Post Status

```bash
curl -X PATCH "http://localhost:7777/admin/community/post/:post_id/status" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "ACTIVE"
  }'
```

### Delete Community Post

```bash
curl -X DELETE "http://localhost:7777/admin/community/post/:post_id"
```

---

</details>

<details>
<summary>Admin Transaction Module</summary>

### Register Finance User

```bash
curl -X POST "http://localhost:7777/admin/transactions/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Finance User",
    "email": "finance@example.com",
    "phone": "0123456789",
    "experienceLevel": "ADVANCED",
    "joined_at": "2026-02-28T12:45:05+06:00",
    "password": "password123"
  }'
```

### Update Finance User

```bash
curl -X POST "http://localhost:7777/admin/transactions/update" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Finance User"
  }'
```

### Get Revenue Stats

```bash
curl -X GET "http://localhost:7777/admin/transactions/revenue/stats"
```

### Get All Transactions

```bash
curl -X GET "http://localhost:7777/admin/transactions/transactions?search=john&page=1&limit=10&payment_type=ONE_TIME&date=2026-05-17"
```

### Add Manual Payment

```bash
curl -X POST "http://localhost:7777/admin/transactions/payments/manual" \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "student_user_id",
    "amount": 2500,
    "currency": "USD",
    "paymentMethod": "stripe",
    "transactionRef": "TXN-2026-001",
    "paymentType": "ONE_TIME",
    "paymentStatus": "PAID",
    "transactionStatus": "SUCCESS",
    "itemType": "COURSE_ENROLLMENT",
    "courseId": "course_id",
    "paymentDate": "2026-04-11T12:00:00.000Z",
    "notes": "Manual entry by finance team"
  }'
```

### Get Finance And Payments Dashboard

```bash
curl -X GET "http://localhost:7777/finance-and-payments"
```

---

</details>

<details>
<summary>Notification Module</summary>

### Get Notifications

```bash
curl -X GET "http://localhost:7777/notification?page=1&limit=10&search=message"
```

### Mark Notification As Read

```bash
curl -X PATCH "http://localhost:7777/notification/:id/read"
```

### Mark All Notifications As Read

```bash
curl -X PATCH "http://localhost:7777/notification/read-all"
```

### Delete Notification

```bash
curl -X DELETE "http://localhost:7777/notification/:id"
```

### Delete All Notifications

```bash
curl -X DELETE "http://localhost:7777/notification"
```

---

</details>

<details>
<summary>Chat Conversations Module</summary>

Controller source: `src/modules/chat/conversations/conversations.controller.ts`

### Create DM Conversation

```bash
curl -X POST "http://localhost:7777/conversations" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "DM",
    "participant_id": "USER_ID"
  }'
```

### Create Group Conversation

```bash
curl -X POST "http://localhost:7777/conversations" \
  -F "type=GROUP" \
  -F "title=Acting Batch Group" \
  -F "participant_ids=USER_ID_1" \
  -F "participant_ids=USER_ID_2" \
  -F "avatar=@/path/to/group-avatar.jpg"
```

### Get My Conversations

```bash
curl -X GET "http://localhost:7777/conversations?type=DM&limit=10&cursor=CURSOR_VALUE"
```

### Mark Conversation As Read

```bash
curl -X PATCH "http://localhost:7777/conversations/:conversation_id/read" \
  -H "Content-Type: application/json" \
  -d '{
    "up_to_message_id": "MESSAGE_ID"
  }'
```

### Add Conversation Members

```bash
curl -X POST "http://localhost:7777/conversations/:conversation_id/members" \
  -H "Content-Type: application/json" \
  -d '{
    "member_ids": ["USER_ID_1", "USER_ID_2"]
  }'
```

### Get Group Members

```bash
curl -X GET "http://localhost:7777/conversations/:conversation_id/members?role=ADMIN"
```

### Update Member Role

```bash
curl -X PATCH "http://localhost:7777/conversations/:conversation_id/members/:member_id/role" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "ADMIN"
  }'
```

### Remove Member

```bash
curl -X DELETE "http://localhost:7777/conversations/:conversation_id/members/:member_id"
```

### Leave Group Conversation

```bash
curl -X DELETE "http://localhost:7777/conversations/:conversation_id/leave"
```

### Delete Conversation

```bash
curl -X DELETE "http://localhost:7777/conversations/:conversation_id"
```

### Clear Conversation For Me

```bash
curl -X PATCH "http://localhost:7777/conversations/:conversation_id/clear"
```

### Update Conversation Silent Until

```bash
curl -X PATCH "http://localhost:7777/conversations/:conversation_id/silent" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "until",
    "until_at": "2026-12-31T23:59:59.999Z"
  }'
```

### Update Conversation Silent Forever

```bash
curl -X PATCH "http://localhost:7777/conversations/:conversation_id/silent" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "forever"
  }'
```

### Turn Off Conversation Silent

```bash
curl -X PATCH "http://localhost:7777/conversations/:conversation_id/silent" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "off"
  }'
```

### Get Conversation Attachments

```bash
curl -X GET "http://localhost:7777/conversations/:conversation_id/attachments?type=media&limit=10&cursor=CURSOR_VALUE"
```

### Report User From Chat

```bash
curl -X POST "http://localhost:7777/conversations/report/:reported_user_id" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "abusive behavior"
  }'
```

---

</details>

<details>
<summary>Chat Messages Module</summary>

Controller source: `src/modules/chat/messages/messages.controller.ts`

### Get Conversation Messages

```bash
curl -X GET "http://localhost:7777/conversations/:conversation_id/messages?limit=20&cursor=CURSOR_VALUE"
```

### Send Text Message

```bash
curl -X POST "http://localhost:7777/conversations/:conversation_id/messages" \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "TEXT",
    "content": {
      "text": "Hello"
    }
  }'
```

### Send Reply Message

```bash
curl -X POST "http://localhost:7777/conversations/:conversation_id/messages" \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "TEXT",
    "content": {
      "text": "Replying to your message"
    },
    "reply_to_id": "MESSAGE_ID"
  }'
```

### Send Message With Attachments

```bash
curl -X POST "http://localhost:7777/conversations/:conversation_id/messages" \
  -F "kind=FILE" \
  -F "content={\"text\":\"See attachment\"}" \
  -F "attachments=@/path/to/file.pdf" \
  -F "attachments=@/path/to/image.jpg"
```

### Delete Message

```bash
curl -X DELETE "http://localhost:7777/conversations/messages/:message_id"
```

---

</details>

<details>
<summary>Chat Users Module</summary>

Controller source: `src/modules/chat/users/users.controller.ts`

### Discover Users

```bash
curl -X GET "http://localhost:7777/users/discover?search=Moses%20Simmons&type=teacher&limit=10&cursor=CURSOR_VALUE"
```

### Get Block Status

```bash
curl -X GET "http://localhost:7777/users/:id/block-status"
```

### Block User

```bash
curl -X POST "http://localhost:7777/users/:id/block"
```

### Unblock User

```bash
curl -X DELETE "http://localhost:7777/users/:id/block"
```

---

</details>

<details>
<summary>Chat RTC Module</summary>

Controller source: `src/modules/chat/rtc/rtc.controller.ts`

### RTC Health

```bash
curl -X GET "http://localhost:7777/rtc/health"
```

### Get Active Call State

```bash
curl -X GET "http://localhost:7777/rtc/conversations/:conversation_id/state"
```

### Start Video Call

```bash
curl -X POST "http://localhost:7777/rtc/conversations/:conversation_id/start" \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "VIDEO"
  }'
```

### Start Audio Call

```bash
curl -X POST "http://localhost:7777/rtc/conversations/:conversation_id/start" \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "AUDIO"
  }'
```

### Join Active Call

```bash
curl -X POST "http://localhost:7777/rtc/conversations/:conversation_id/join"
```

### Issue Call Token

```bash
curl -X POST "http://localhost:7777/rtc/conversations/:conversation_id/token"
```

### Decline Incoming Call

```bash
curl -X POST "http://localhost:7777/rtc/conversations/:conversation_id/decline"
```

### Leave Call

```bash
curl -X POST "http://localhost:7777/rtc/conversations/:conversation_id/leave"
```

### End Call For Everyone

```bash
curl -X POST "http://localhost:7777/rtc/conversations/:conversation_id/end"
```

### Update My Participant Media State

```bash
curl -X PATCH "http://localhost:7777/rtc/conversations/:conversation_id/participants/me" \
  -H "Content-Type: application/json" \
  -d '{
    "camera": true,
    "microphone": true,
    "is_screen_sharing": false
  }'
```

---

</details>

<details>
<summary>Payment Module</summary>

### Create Checkout Session (Course)

```bash
curl -X POST "http://localhost:7777/payment/stripe/checkout" \
  -H "Content-Type: application/json" \
  -d '{
    "enrollment_id": "ENROLLMENT_ID"
  }'
```

### Create Checkout Session (Event)

```bash
curl -X POST "http://localhost:7777/payment/stripe/checkout" \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "EVENT_ID"
  }'
```

### Verify Payment Session

```bash
curl -X GET "http://localhost:7777/payment/stripe/verify/:session_id"
```

### Stripe Webhook

```bash
curl -X POST "http://localhost:7777/payment/stripe/webhook" \
  -H "stripe-signature: STRIPE_SIGNATURE" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "checkout.session.completed",
    "data": {
      "object": {
        "id": "cs_test_..."
      }
    }
  }'
```

</details>
