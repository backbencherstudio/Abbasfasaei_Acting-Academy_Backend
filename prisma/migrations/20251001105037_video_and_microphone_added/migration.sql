-- AlterTable
ALTER TABLE "public"."CallParticipant" ADD COLUMN     "camera" TEXT NOT NULL DEFAULT 'on',
ADD COLUMN     "microphone" TEXT NOT NULL DEFAULT 'on';
