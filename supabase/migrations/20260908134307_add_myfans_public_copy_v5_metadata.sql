alter table public.myfans_daily_plan_posts
  add column if not exists generator_version text not null default 'public-copy-v5',
  add column if not exists copy_input_hash text not null default '';

create index if not exists myfans_daily_plan_posts_generator_hash_idx
  on public.myfans_daily_plan_posts (daily_plan_id, generator_version, copy_input_hash);

revoke all on table public.myfans_daily_plan_posts from anon, authenticated;
