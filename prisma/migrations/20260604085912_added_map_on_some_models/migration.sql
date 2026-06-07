-- AlterTable
ALTER TABLE "public"."community_comments" RENAME CONSTRAINT "CommunityComment_pkey" TO "community_comments_pkey";

-- AlterTable
ALTER TABLE "public"."community_likes" RENAME CONSTRAINT "CommunityLike_pkey" TO "community_likes_pkey";

-- AlterTable
ALTER TABLE "public"."community_posts" RENAME CONSTRAINT "CommunityPost_pkey" TO "community_posts_pkey";

-- AlterTable
ALTER TABLE "public"."courses" RENAME CONSTRAINT "Course_pkey" TO "courses_pkey";

-- AlterTable
ALTER TABLE "public"."reports" RENAME CONSTRAINT "Report_pkey" TO "reports_pkey";

-- RenameForeignKey
ALTER TABLE "public"."community_comments" RENAME CONSTRAINT "CommunityComment_parent_id_fkey" TO "community_comments_parent_id_fkey";

-- RenameForeignKey
ALTER TABLE "public"."community_comments" RENAME CONSTRAINT "CommunityComment_post_id_fkey" TO "community_comments_post_id_fkey";

-- RenameForeignKey
ALTER TABLE "public"."community_comments" RENAME CONSTRAINT "CommunityComment_user_id_fkey" TO "community_comments_user_id_fkey";

-- RenameForeignKey
ALTER TABLE "public"."community_likes" RENAME CONSTRAINT "CommunityLike_comment_id_fkey" TO "community_likes_comment_id_fkey";

-- RenameForeignKey
ALTER TABLE "public"."community_likes" RENAME CONSTRAINT "CommunityLike_post_id_fkey" TO "community_likes_post_id_fkey";

-- RenameForeignKey
ALTER TABLE "public"."community_likes" RENAME CONSTRAINT "CommunityLike_user_id_fkey" TO "community_likes_user_id_fkey";

-- RenameForeignKey
ALTER TABLE "public"."community_posts" RENAME CONSTRAINT "CommunityPost_author_id_fkey" TO "community_posts_author_id_fkey";

-- RenameForeignKey
ALTER TABLE "public"."courses" RENAME CONSTRAINT "Course_creator_id_fkey" TO "courses_creator_id_fkey";

-- RenameForeignKey
ALTER TABLE "public"."courses" RENAME CONSTRAINT "Course_instructor_id_fkey" TO "courses_instructor_id_fkey";

-- RenameForeignKey
ALTER TABLE "public"."reports" RENAME CONSTRAINT "Report_message_id_fkey" TO "reports_message_id_fkey";

-- RenameForeignKey
ALTER TABLE "public"."reports" RENAME CONSTRAINT "Report_reporter_id_fkey" TO "reports_reporter_id_fkey";

-- RenameIndex
ALTER INDEX "public"."Report_message_id_idx" RENAME TO "reports_message_id_idx";
