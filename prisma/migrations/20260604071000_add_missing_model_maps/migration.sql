DO $$
BEGIN
  IF to_regclass('public."Course"') IS NOT NULL
     AND to_regclass('public.courses') IS NULL THEN
    ALTER TABLE "public"."Course" RENAME TO "courses";
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public."CommunityPost"') IS NOT NULL
     AND to_regclass('public.community_posts') IS NULL THEN
    ALTER TABLE "public"."CommunityPost" RENAME TO "community_posts";
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public."CommunityLike"') IS NOT NULL
     AND to_regclass('public.community_likes') IS NULL THEN
    ALTER TABLE "public"."CommunityLike" RENAME TO "community_likes";
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public."CommunityComment"') IS NOT NULL
     AND to_regclass('public.community_comments') IS NULL THEN
    ALTER TABLE "public"."CommunityComment" RENAME TO "community_comments";
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public."Report"') IS NOT NULL
     AND to_regclass('public.reports') IS NULL THEN
    ALTER TABLE "public"."Report" RENAME TO "reports";
  END IF;
END $$;
