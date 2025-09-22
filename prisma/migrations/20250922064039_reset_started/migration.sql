/*
  Warnings:

  - The values [YEARLY] on the enum `PaymentType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PaymentType_new" AS ENUM ('MONTHLY', 'ONE_TIME');
ALTER TABLE "enrollment_payments" ALTER COLUMN "payment_type" TYPE "PaymentType_new" USING ("payment_type"::text::"PaymentType_new");
ALTER TABLE "payment_histories" ALTER COLUMN "payment_type" TYPE "PaymentType_new" USING ("payment_type"::text::"PaymentType_new");
ALTER TABLE "enrollments" ALTER COLUMN "payment_type" TYPE "PaymentType_new" USING ("payment_type"::text::"PaymentType_new");
ALTER TYPE "PaymentType" RENAME TO "PaymentType_old";
ALTER TYPE "PaymentType_new" RENAME TO "PaymentType";
DROP TYPE "PaymentType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "CommunityComment" DROP CONSTRAINT "CommunityComment_parentId_fkey";

-- DropForeignKey
ALTER TABLE "CommunityComment" DROP CONSTRAINT "CommunityComment_postId_fkey";

-- DropForeignKey
ALTER TABLE "CommunityComment" DROP CONSTRAINT "CommunityComment_userId_fkey";

-- DropForeignKey
ALTER TABLE "CommunityCommentLike" DROP CONSTRAINT "CommunityCommentLike_commentId_fkey";

-- DropForeignKey
ALTER TABLE "CommunityCommentLike" DROP CONSTRAINT "CommunityCommentLike_userId_fkey";

-- DropForeignKey
ALTER TABLE "CommunityLike" DROP CONSTRAINT "CommunityLike_postId_fkey";

-- DropForeignKey
ALTER TABLE "CommunityLike" DROP CONSTRAINT "CommunityLike_userId_fkey";

-- DropForeignKey
ALTER TABLE "CommunityPool" DROP CONSTRAINT "CommunityPool_postId_fkey";

-- DropForeignKey
ALTER TABLE "CommunityPoolVote" DROP CONSTRAINT "CommunityPoolVote_poolId_fkey";

-- DropForeignKey
ALTER TABLE "CommunityPoolVote" DROP CONSTRAINT "CommunityPoolVote_userId_fkey";

-- DropForeignKey
ALTER TABLE "CommunityPost" DROP CONSTRAINT "CommunityPost_author_Id_fkey";

-- DropForeignKey
ALTER TABLE "CommunityShare" DROP CONSTRAINT "CommunityShare_postId_fkey";

-- DropForeignKey
ALTER TABLE "CommunityShare" DROP CONSTRAINT "CommunityShare_userId_fkey";

-- DropForeignKey
ALTER TABLE "Course" DROP CONSTRAINT "Course_instructorId_fkey";

-- DropForeignKey
ALTER TABLE "UserReport" DROP CONSTRAINT "UserReport_reportedUserId_fkey";

-- DropForeignKey
ALTER TABLE "UserReport" DROP CONSTRAINT "UserReport_reporterId_fkey";

-- DropForeignKey
ALTER TABLE "acting_goals" DROP CONSTRAINT "acting_goals_enrollmentId_fkey";

-- DropForeignKey
ALTER TABLE "acting_goals" DROP CONSTRAINT "acting_goals_userId_fkey";

-- DropForeignKey
ALTER TABLE "assignment_grades" DROP CONSTRAINT "assignment_grades_assignmentId_fkey";

-- DropForeignKey
ALTER TABLE "assignment_grades" DROP CONSTRAINT "assignment_grades_studentId_fkey";

-- DropForeignKey
ALTER TABLE "assignment_grades" DROP CONSTRAINT "assignment_grades_submissionId_fkey";

-- DropForeignKey
ALTER TABLE "assignment_grades" DROP CONSTRAINT "assignment_grades_teacherId_fkey";

-- DropForeignKey
ALTER TABLE "assignment_submissions" DROP CONSTRAINT "assignment_submissions_assignmentId_fkey";

-- DropForeignKey
ALTER TABLE "assignment_submissions" DROP CONSTRAINT "assignment_submissions_studentId_fkey";

-- DropForeignKey
ALTER TABLE "assignments" DROP CONSTRAINT "assignments_moduleClassId_fkey";

-- DropForeignKey
ALTER TABLE "assignments" DROP CONSTRAINT "assignments_teacherId_fkey";

-- DropForeignKey
ALTER TABLE "attendances" DROP CONSTRAINT "attendances_class_id_fkey";

-- DropForeignKey
ALTER TABLE "conversations" DROP CONSTRAINT "conversations_creator_id_fkey";

-- DropForeignKey
ALTER TABLE "conversations" DROP CONSTRAINT "conversations_participant_id_fkey";

-- DropForeignKey
ALTER TABLE "course_modules" DROP CONSTRAINT "course_modules_courseId_fkey";

-- DropForeignKey
ALTER TABLE "digital_contract_signings" DROP CONSTRAINT "digital_contract_signings_enrollmentId_fkey";

-- DropForeignKey
ALTER TABLE "digital_signatures" DROP CONSTRAINT "digital_signatures_digital_contract_signing_id_fkey";

-- DropForeignKey
ALTER TABLE "digital_signatures" DROP CONSTRAINT "digital_signatures_rules_regulations_signing_id_fkey";

-- DropForeignKey
ALTER TABLE "enrollment_payments" DROP CONSTRAINT "enrollment_payments_enrollmentId_fkey";

-- DropForeignKey
ALTER TABLE "enrollment_payments" DROP CONSTRAINT "enrollment_payments_user_id_fkey";

-- DropForeignKey
ALTER TABLE "enrollment_profiles" DROP CONSTRAINT "enrollment_profiles_enrollmentId_fkey";

-- DropForeignKey
ALTER TABLE "enrollment_terms_and_conditions" DROP CONSTRAINT "enrollment_terms_and_conditions_enrollmentId_fkey";

-- DropForeignKey
ALTER TABLE "enrollments" DROP CONSTRAINT "enrollments_courseId_fkey";

-- DropForeignKey
ALTER TABLE "enrollments" DROP CONSTRAINT "enrollments_user_id_fkey";

-- DropForeignKey
ALTER TABLE "events" DROP CONSTRAINT "events_created_by_fkey";

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_deletedById_fkey";

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_receiver_id_fkey";

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_sender_user_id_fkey";

-- DropForeignKey
ALTER TABLE "module_classes" DROP CONSTRAINT "module_classes_moduleId_fkey";

-- DropForeignKey
ALTER TABLE "payment_histories" DROP CONSTRAINT "payment_histories_userPaymentId_fkey";

-- DropForeignKey
ALTER TABLE "payment_histories" DROP CONSTRAINT "payment_histories_user_id_fkey";

-- DropForeignKey
ALTER TABLE "user_settings" DROP CONSTRAINT "user_settings_setting_id_fkey";

-- DropForeignKey
ALTER TABLE "user_settings" DROP CONSTRAINT "user_settings_user_id_fkey";

-- AddForeignKey
ALTER TABLE "enrollment_payments" ADD CONSTRAINT "enrollment_payments_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_payments" ADD CONSTRAINT "enrollment_payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_histories" ADD CONSTRAINT "payment_histories_userPaymentId_fkey" FOREIGN KEY ("userPaymentId") REFERENCES "enrollment_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_histories" ADD CONSTRAINT "payment_histories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_modules" ADD CONSTRAINT "course_modules_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_classes" ADD CONSTRAINT "module_classes_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "course_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_moduleClassId_fkey" FOREIGN KEY ("moduleClassId") REFERENCES "module_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "module_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_grades" ADD CONSTRAINT "assignment_grades_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_grades" ADD CONSTRAINT "assignment_grades_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_grades" ADD CONSTRAINT "assignment_grades_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_grades" ADD CONSTRAINT "assignment_grades_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "assignment_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digital_contract_signings" ADD CONSTRAINT "digital_contract_signings_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_terms_and_conditions" ADD CONSTRAINT "enrollment_terms_and_conditions_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digital_signatures" ADD CONSTRAINT "digital_signatures_digital_contract_signing_id_fkey" FOREIGN KEY ("digital_contract_signing_id") REFERENCES "digital_contract_signings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digital_signatures" ADD CONSTRAINT "digital_signatures_rules_regulations_signing_id_fkey" FOREIGN KEY ("rules_regulations_signing_id") REFERENCES "enrollment_terms_and_conditions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acting_goals" ADD CONSTRAINT "acting_goals_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acting_goals" ADD CONSTRAINT "acting_goals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_profiles" ADD CONSTRAINT "enrollment_profiles_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_author_Id_fkey" FOREIGN KEY ("author_Id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityLike" ADD CONSTRAINT "CommunityLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityLike" ADD CONSTRAINT "CommunityLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityComment" ADD CONSTRAINT "CommunityComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CommunityComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityComment" ADD CONSTRAINT "CommunityComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityComment" ADD CONSTRAINT "CommunityComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityCommentLike" ADD CONSTRAINT "CommunityCommentLike_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "CommunityComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityCommentLike" ADD CONSTRAINT "CommunityCommentLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityShare" ADD CONSTRAINT "CommunityShare_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityShare" ADD CONSTRAINT "CommunityShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPool" ADD CONSTRAINT "CommunityPool_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPoolVote" ADD CONSTRAINT "CommunityPoolVote_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "CommunityPool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPoolVote" ADD CONSTRAINT "CommunityPoolVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserReport" ADD CONSTRAINT "UserReport_reportedUserId_fkey" FOREIGN KEY ("reportedUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserReport" ADD CONSTRAINT "UserReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_setting_id_fkey" FOREIGN KEY ("setting_id") REFERENCES "settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
