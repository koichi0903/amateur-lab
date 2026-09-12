create table if not exists public.myfans_x_account_metrics (
  id bigint generated always as identity primary key,
  metric_date date not null,
  approved_media_id bigint not null references public.myfans_approved_media(id) on delete restrict,
  followers_count integer not null default 0 check (followers_count >= 0),
  following_count integer check (following_count is null or following_count >= 0),
  profile_visits integer not null default 0 check (profile_visits >= 0),
  total_impressions integer not null default 0 check (total_impressions >= 0),
  posts_count integer not null default 0 check (posts_count >= 0),
  likes integer not null default 0 check (likes >= 0),
  reposts integer not null default 0 check (reposts >= 0),
  replies integer not null default 0 check (replies >= 0),
  affiliate_clicks integer not null default 0 check (affiliate_clicks >= 0),
  conversions integer not null default 0 check (conversions >= 0),
  reward_amount integer not null default 0 check (reward_amount >= 0),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists myfans_x_account_metrics_media_date_idx
  on public.myfans_x_account_metrics (approved_media_id, metric_date);

create index if not exists myfans_x_account_metrics_date_idx
  on public.myfans_x_account_metrics (metric_date desc);

alter table public.myfans_x_account_metrics enable row level security;

revoke all on table public.myfans_x_account_metrics from anon, authenticated;
revoke all on sequence public.myfans_x_account_metrics_id_seq from anon, authenticated;
