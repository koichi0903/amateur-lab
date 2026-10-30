alter table public.myfans_x_posts
  add column if not exists growth_score_snapshot integer not null default 0 check (growth_score_snapshot >= 0 and growth_score_snapshot <= 100),
  add column if not exists revenue_score_snapshot integer not null default 0 check (revenue_score_snapshot >= 0 and revenue_score_snapshot <= 100),
  add column if not exists creator_ltv_score_snapshot integer not null default 0 check (creator_ltv_score_snapshot >= 0 and creator_ltv_score_snapshot <= 100),
  add column if not exists expected_reward_per_1000_impressions_snapshot integer not null default 0 check (expected_reward_per_1000_impressions_snapshot >= 0);

alter table public.myfans_x_posts
  drop constraint if exists myfans_x_posts_post_type_check;

alter table public.myfans_x_posts
  add constraint myfans_x_posts_post_type_check
  check (post_type in (
    'discovery',
    'comparison',
    'avoid_bad_buy',
    'new_creator',
    'single_intro',
    'trend',
    'profile_cta',
    'review_summary',
    'discovery_interest',
    'comparison_review',
    'body_link_sales',
    'reply_link_sales',
    'winner_reuse',
    'other'
  ));

create table if not exists public.myfans_companion_imports (
  id bigint generated always as identity primary key,
  page_url text not null default '',
  creator_name text not null default '',
  product_title text not null default '',
  product_url text not null default '',
  affiliate_url text not null default '',
  price integer not null default 0 check (price >= 0),
  reward_rate numeric(5,2) not null default 0 check (reward_rate >= 0 and reward_rate <= 100),
  plan_signup_reward integer not null default 0 check (plan_signup_reward >= 0),
  recurring_reward_rate numeric(5,2) not null default 0 check (recurring_reward_rate >= 0 and recurring_reward_rate <= 100),
  likes_count integer not null default 0 check (likes_count >= 0),
  published_at text not null default '',
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.myfans_companion_imports enable row level security;
revoke all on table public.myfans_companion_imports from anon, authenticated;
revoke all on sequence public.myfans_companion_imports_id_seq from anon, authenticated;

create index if not exists myfans_x_posts_score_snapshot_idx
  on public.myfans_x_posts (growth_score_snapshot desc, revenue_score_snapshot desc, creator_ltv_score_snapshot desc);

create index if not exists myfans_companion_imports_created_idx
  on public.myfans_companion_imports (created_at desc);
