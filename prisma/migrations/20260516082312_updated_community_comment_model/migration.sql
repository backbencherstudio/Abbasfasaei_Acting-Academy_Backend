-- DropForeignKey
ALTER TABLE "public"."CommunityComment" DROP CONSTRAINT "CommunityComment_parent_id_fkey";

-- AddForeignKey
ALTER TABLE "public"."CommunityComment" ADD CONSTRAINT "CommunityComment_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."CommunityComment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
