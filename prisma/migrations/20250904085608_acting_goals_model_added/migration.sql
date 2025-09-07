/*
  Warnings:

  - You are about to drop the column `acting_goals` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `Assignment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AssignmentSubmission` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CourseLesson` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CourseModule` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DigitalSignature` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Enrollment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EnrollmentContractTerms` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EnrollmentPayment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EnrollmentProfile` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EnrollmentTermsAndConditions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `LessonAsset` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `LessonProgress` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Assignment" DROP CONSTRAINT "Assignment_lessonId_fkey";

-- DropForeignKey
ALTER TABLE "AssignmentSubmission" DROP CONSTRAINT "AssignmentSubmission_assignmentId_fkey";

-- DropForeignKey
ALTER TABLE "AssignmentSubmission" DROP CONSTRAINT "AssignmentSubmission_studentId_fkey";

-- DropForeignKey
ALTER TABLE "CourseLesson" DROP CONSTRAINT "CourseLesson_moduleId_fkey";

-- DropForeignKey
ALTER TABLE "CourseModule" DROP CONSTRAINT "CourseModule_courseId_fkey";

-- DropForeignKey
ALTER TABLE "DigitalSignature" DROP CONSTRAINT "DigitalSignature_enrollmentId_fkey";

-- DropForeignKey
ALTER TABLE "Enrollment" DROP CONSTRAINT "Enrollment_courseId_fkey";

-- DropForeignKey
ALTER TABLE "Enrollment" DROP CONSTRAINT "Enrollment_user_id_fkey";

-- DropForeignKey
ALTER TABLE "EnrollmentContractTerms" DROP CONSTRAINT "EnrollmentContractTerms_enrollmentId_fkey";

-- DropForeignKey
ALTER TABLE "EnrollmentPayment" DROP CONSTRAINT "EnrollmentPayment_enrollmentId_fkey";

-- DropForeignKey
ALTER TABLE "EnrollmentProfile" DROP CONSTRAINT "EnrollmentProfile_enrollmentId_fkey";

-- DropForeignKey
ALTER TABLE "EnrollmentTermsAndConditions" DROP CONSTRAINT "EnrollmentTermsAndConditions_enrollmentId_fkey";

-- DropForeignKey
ALTER TABLE "LessonAsset" DROP CONSTRAINT "LessonAsset_lessonId_fkey";

-- DropForeignKey
ALTER TABLE "LessonProgress" DROP CONSTRAINT "LessonProgress_enrollmentId_fkey";

-- DropForeignKey
ALTER TABLE "LessonProgress" DROP CONSTRAINT "LessonProgress_lessonId_fkey";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "acting_goals",
ADD COLUMN     "actingGoalsId" TEXT;

-- DropTable
DROP TABLE "Assignment";

-- DropTable
DROP TABLE "AssignmentSubmission";

-- DropTable
DROP TABLE "CourseLesson";

-- DropTable
DROP TABLE "CourseModule";

-- DropTable
DROP TABLE "DigitalSignature";

-- DropTable
DROP TABLE "Enrollment";

-- DropTable
DROP TABLE "EnrollmentContractTerms";

-- DropTable
DROP TABLE "EnrollmentPayment";

-- DropTable
DROP TABLE "EnrollmentProfile";

-- DropTable
DROP TABLE "EnrollmentTermsAndConditions";

-- DropTable
DROP TABLE "LessonAsset";

-- DropTable
DROP TABLE "LessonProgress";

-- CreateTable
CREATE TABLE "course_modules" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_lessons" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_assets" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "type" "AssetType" NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignments" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment_submissions" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grade" TEXT,

    CONSTRAINT "assignment_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_progress" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "lesson_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,
    "course_type" "CourseType" NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "date_of_birth" DATE,
    "experience_level" "ExperienceLevel" NOT NULL,
    "courseId" TEXT,
    "courseModuleId" TEXT,
    "actingGoalsId" TEXT,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollment_contract_terms" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "agreed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "enrollment_contract_terms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollment_terms_and_conditions" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "accepted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "enrollment_terms_and_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "digital_signatures" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "signed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "digital_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollment_payments" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "payment_type" "PaymentType" NOT NULL,
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "payment_method" TEXT NOT NULL,
    "account_holder" TEXT,
    "card_number" TEXT,
    "card_expiry" TEXT,
    "card_cvc" TEXT,
    "invoice_sent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "enrollment_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acting_goals" (
    "id" TEXT NOT NULL,
    "acting_goals" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enrollmentId" TEXT,

    CONSTRAINT "acting_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollment_profiles" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "avatar" TEXT,
    "personal_info" JSONB,
    "account_settings" JSONB,
    "subscription" JSONB,
    "contract_docs" JSONB,
    "feedback" JSONB,
    "push_notification" JSONB,
    "support" JSONB,

    CONSTRAINT "enrollment_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "enrollment_contract_terms_enrollmentId_key" ON "enrollment_contract_terms"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "enrollment_terms_and_conditions_enrollmentId_key" ON "enrollment_terms_and_conditions"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "digital_signatures_enrollmentId_key" ON "digital_signatures"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "enrollment_payments_enrollmentId_key" ON "enrollment_payments"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "acting_goals_userId_key" ON "acting_goals"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "acting_goals_enrollmentId_key" ON "acting_goals"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "enrollment_profiles_enrollmentId_key" ON "enrollment_profiles"("enrollmentId");

-- AddForeignKey
ALTER TABLE "course_modules" ADD CONSTRAINT "course_modules_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_lessons" ADD CONSTRAINT "course_lessons_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "course_modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_assets" ADD CONSTRAINT "lesson_assets_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "course_lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "course_lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "course_lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_contract_terms" ADD CONSTRAINT "enrollment_contract_terms_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_terms_and_conditions" ADD CONSTRAINT "enrollment_terms_and_conditions_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digital_signatures" ADD CONSTRAINT "digital_signatures_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_payments" ADD CONSTRAINT "enrollment_payments_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acting_goals" ADD CONSTRAINT "acting_goals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acting_goals" ADD CONSTRAINT "acting_goals_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_profiles" ADD CONSTRAINT "enrollment_profiles_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
