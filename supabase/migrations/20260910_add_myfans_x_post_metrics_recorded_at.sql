alter table public.myfans_x_posts
  add column if not exists metrics_recorded_at timestamptz;

create index if not exists myfans_x_posts_metrics_inbox_idx
  on public.myfans_x_posts (approved_media_id, metrics_recorded_at, posted_at desc, created_at desc)
  where status = 'posted' or posted_at is not null or x_post_url <> '';

alter table public.myfans_x_posts enable row level security;
revoke all on table public.myfans_x_posts from anon, authenticated;
