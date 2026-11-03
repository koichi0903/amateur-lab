alter table public.myfans_daily_plan_posts
  add column if not exists option_label text not null default 'A',
  add column if not exists option_name text not null default 'おすすめ',
  add column if not exists option_rank integer not null default 1,
  add column if not exists is_selected boolean not null default true,
  add column if not exists selected_at timestamptz,
  add column if not exists novelty_json jsonb not null default '{}'::jsonb;

alter table public.myfans_daily_plan_posts
  drop constraint if exists myfans_daily_plan_posts_daily_plan_id_post_order_key;

create unique index if not exists myfans_daily_plan_posts_plan_order_option_idx
  on public.myfans_daily_plan_posts (daily_plan_id, post_order, option_label);

create unique index if not exists myfans_daily_plan_posts_one_selected_per_slot_idx
  on public.myfans_daily_plan_posts (daily_plan_id, post_order)
  where is_selected;

create index if not exists myfans_daily_plan_posts_selected_idx
  on public.myfans_daily_plan_posts (daily_plan_id, is_selected, post_order);

revoke all on table public.myfans_daily_plan_posts from anon, authenticated;
