-- myfans operations live in the existing Supabase project but stay logically
-- separated from FANZA tables by using the myfans_ prefix throughout.

create table if not exists public.myfans_creators (
  id bigint generated always as identity primary key,
  display_name text not null,
  myfans_url text not null default '',
  x_url text not null default '',
  genre text not null default '',
  activity_note text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists myfans_creators_myfans_url_idx
  on public.myfans_creators (myfans_url)
  where myfans_url <> '';

create index if not exists myfans_creators_active_created_idx
  on public.myfans_creators (is_active, created_at desc);

create table if not exists public.myfans_products (
  id bigint generated always as identity primary key,
  creator_id bigint references public.myfans_creators(id) on delete set null,
  title text not null,
  product_url text not null default '',
  affiliate_url text not null default '',
  source_x_url text not null default '',
  genre text not null default '',
  product_type text not null default 'single'
    check (product_type in ('single', 'plan', 'backnumber_plan', 'backnumber_month', 'gacha', 'other')),
  status text not null default 'candidate'
    check (status in ('candidate', 'approved', 'posted', 'paused', 'rejected')),
  price integer not null default 0 check (price >= 0),
  reward_rate numeric(5,2) not null default 0 check (reward_rate >= 0 and reward_rate <= 100),
  estimated_reward integer not null default 0 check (estimated_reward >= 0),
  plan_signup_reward integer not null default 0 check (plan_signup_reward >= 0),
  recurring_reward_rate numeric(5,2) not null default 0 check (recurring_reward_rate >= 0 and recurring_reward_rate <= 100),
  popularity_rank integer check (popularity_rank is null or popularity_rank > 0),
  likes_count integer not null default 0 check (likes_count >= 0),
  saves_count integer not null default 0 check (saves_count >= 0),
  is_new boolean not null default false,
  selection_reason text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists myfans_products_product_url_idx
  on public.myfans_products (product_url)
  where product_url <> '';

create index if not exists myfans_products_status_created_idx
  on public.myfans_products (status, created_at desc);

create index if not exists myfans_products_creator_idx
  on public.myfans_products (creator_id)
  where creator_id is not null;

create table if not exists public.myfans_x_posts (
  id bigint generated always as identity primary key,
  product_id bigint references public.myfans_products(id) on delete set null,
  post_type text not null
    check (post_type in ('discovery', 'comparison', 'avoid_bad_buy', 'new_creator', 'single_intro', 'trend', 'other')),
  status text not null default 'draft'
    check (status in ('draft', 'ready', 'posted', 'archived')),
  body text not null,
  self_reply text not null default '',
  includes_pr boolean not null default true,
  source_x_url text not null default '',
  affiliate_url text not null default '',
  selection_reason text not null default '',
  scheduled_at timestamptz,
  posted_at timestamptz,
  x_post_url text not null default '',
  impressions integer not null default 0 check (impressions >= 0),
  likes_count integer not null default 0 check (likes_count >= 0),
  reposts_count integer not null default 0 check (reposts_count >= 0),
  replies_count integer not null default 0 check (replies_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists myfans_x_posts_status_created_idx
  on public.myfans_x_posts (status, created_at desc);

create index if not exists myfans_x_posts_product_idx
  on public.myfans_x_posts (product_id)
  where product_id is not null;

create table if not exists public.myfans_affiliate_clicks (
  id bigint generated always as identity primary key,
  product_id bigint references public.myfans_products(id) on delete set null,
  x_post_id bigint references public.myfans_x_posts(id) on delete set null,
  clicked_at timestamptz not null default now(),
  source text not null default 'x'
    check (source in ('x', 'profile', 'fixed_post', 'manual', 'other')),
  placement text not null default 'self_reply'
    check (placement in ('body', 'self_reply', 'fixed_post', 'profile', 'manual', 'other')),
  note text not null default ''
);

create index if not exists myfans_affiliate_clicks_clicked_at_idx
  on public.myfans_affiliate_clicks (clicked_at desc);

create index if not exists myfans_affiliate_clicks_product_idx
  on public.myfans_affiliate_clicks (product_id)
  where product_id is not null;

create table if not exists public.myfans_conversions (
  id bigint generated always as identity primary key,
  product_id bigint references public.myfans_products(id) on delete set null,
  x_post_id bigint references public.myfans_x_posts(id) on delete set null,
  conversion_type text not null default 'single'
    check (conversion_type in ('single', 'plan', 'backnumber_plan', 'backnumber_month', 'gacha', 'other')),
  occurred_at timestamptz not null default now(),
  sale_amount integer not null default 0 check (sale_amount >= 0),
  reward_amount integer not null default 0 check (reward_amount >= 0),
  reward_rate numeric(5,2) not null default 0 check (reward_rate >= 0 and reward_rate <= 100),
  source_file text not null default '',
  row_key text not null unique,
  note text not null default '',
  imported_at timestamptz not null default now()
);

create index if not exists myfans_conversions_occurred_at_idx
  on public.myfans_conversions (occurred_at desc);

create index if not exists myfans_conversions_product_idx
  on public.myfans_conversions (product_id)
  where product_id is not null;

create table if not exists public.myfans_revenue_imports (
  id bigint generated always as identity primary key,
  report_month date not null,
  source_file text not null,
  rows_count integer not null default 0 check (rows_count >= 0),
  total_sales_amount integer not null default 0 check (total_sales_amount >= 0),
  total_reward_amount integer not null default 0 check (total_reward_amount >= 0),
  imported_at timestamptz not null default now(),
  notes text not null default ''
);

create unique index if not exists myfans_revenue_imports_month_file_idx
  on public.myfans_revenue_imports (report_month, source_file);

create table if not exists public.myfans_daily_metrics (
  id bigint generated always as identity primary key,
  metric_date date not null,
  product_id bigint references public.myfans_products(id) on delete cascade,
  x_post_id bigint references public.myfans_x_posts(id) on delete set null,
  impressions integer not null default 0 check (impressions >= 0),
  engagements integer not null default 0 check (engagements >= 0),
  clicks integer not null default 0 check (clicks >= 0),
  conversions integer not null default 0 check (conversions >= 0),
  reward_amount integer not null default 0 check (reward_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists myfans_daily_metrics_scope_date_idx
  on public.myfans_daily_metrics (
    metric_date,
    coalesce(product_id, 0),
    coalesce(x_post_id, 0)
  );

create index if not exists myfans_daily_metrics_product_date_idx
  on public.myfans_daily_metrics (product_id, metric_date desc)
  where product_id is not null;

alter table public.myfans_creators enable row level security;
alter table public.myfans_products enable row level security;
alter table public.myfans_x_posts enable row level security;
alter table public.myfans_affiliate_clicks enable row level security;
alter table public.myfans_conversions enable row level security;
alter table public.myfans_revenue_imports enable row level security;
alter table public.myfans_daily_metrics enable row level security;

revoke all on table public.myfans_creators from anon, authenticated;
revoke all on table public.myfans_products from anon, authenticated;
revoke all on table public.myfans_x_posts from anon, authenticated;
revoke all on table public.myfans_affiliate_clicks from anon, authenticated;
revoke all on table public.myfans_conversions from anon, authenticated;
revoke all on table public.myfans_revenue_imports from anon, authenticated;
revoke all on table public.myfans_daily_metrics from anon, authenticated;

revoke all on sequence public.myfans_creators_id_seq from anon, authenticated;
revoke all on sequence public.myfans_products_id_seq from anon, authenticated;
revoke all on sequence public.myfans_x_posts_id_seq from anon, authenticated;
revoke all on sequence public.myfans_affiliate_clicks_id_seq from anon, authenticated;
revoke all on sequence public.myfans_conversions_id_seq from anon, authenticated;
revoke all on sequence public.myfans_revenue_imports_id_seq from anon, authenticated;
revoke all on sequence public.myfans_daily_metrics_id_seq from anon, authenticated;
