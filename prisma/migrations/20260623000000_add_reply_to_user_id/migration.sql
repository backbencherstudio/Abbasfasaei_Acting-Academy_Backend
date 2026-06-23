-- AlterEnum
BEGIN;
CREATE TYPE "public"."EnrollmentType_new" AS ENUM ('FULL_PAYMENT', 'INSTALLMENT', 'FREE');
ALTER TABLE "public"."enrollments" ALTER COLUMN "enrollment_type" DROP DEFAULT;
ALTER TABLE "public"."enrollments" ALTER COLUMN "enrollment_type" TYPE "public"."EnrollmentType_new" USING ("enrollment_type"::text::"public"."EnrollmentType_new");
ALTER TYPE "public"."EnrollmentType" RENAME TO "EnrollmentType_old";
ALTER TYPE "public"."EnrollmentType_new" RENAME TO "EnrollmentType";
DROP TYPE "public"."EnrollmentType_old";
ALTER TABLE "public"."enrollments" ALTER COLUMN "enrollment_type" SET DEFAULT 'FULL_PAYMENT';
COMMIT;

-- AlterTable
ALTER TABLE "public"."community_comments" ADD COLUMN     "reply_to_user_id" TEXT;

-- AddForeignKey
ALTER TABLE "public"."community_comments" ADD CONSTRAINT "community_comments_reply_to_user_id_fkey" FOREIGN KEY ("reply_to_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
