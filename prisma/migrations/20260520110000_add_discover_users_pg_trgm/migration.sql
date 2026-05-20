CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS users_name_trgm_idx
ON public.users
USING GIN (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS users_username_trgm_idx
ON public.users
USING GIN (username gin_trgm_ops);

CREATE INDEX IF NOT EXISTS enrollments_user_course_status_idx
ON public.enrollments (user_id, course_id, status);

CREATE INDEX IF NOT EXISTS blocks_blocker_blocked_idx
ON public.blocks (blocker_id, blocked_id);

CREATE INDEX IF NOT EXISTS community_posts_author_idx
ON public."CommunityPost" (author_id);

CREATE INDEX IF NOT EXISTS community_likes_user_post_idx
ON public."CommunityLike" (user_id, post_id);

CREATE INDEX IF NOT EXISTS community_comments_user_post_deleted_idx
ON public."CommunityComment" (user_id, post_id, deleted_at);

CREATE INDEX IF NOT EXISTS community_poll_votes_user_option_idx
ON public.community_poll_votes (user_id, option_id);

CREATE INDEX IF NOT EXISTS community_poll_options_post_idx
ON public.community_poll_options (post_id);
