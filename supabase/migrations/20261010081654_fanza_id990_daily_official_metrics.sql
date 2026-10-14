-- Daily official DMM affiliate summary for the Hakkutsu LAB account.
-- Keep it separate from the site's click events and monthly product CSV rows.
create table if not exists public.fanza_id990_daily_official_metrics (
  report_date date primary key,
  affiliate_id text not null default '990' check (affiliate_id = '990'),
  click_count integer not null check (click_count >= 0),
  direct_reward_count integer not null default 0 check (direct_reward_count >= 0),
  direct_reward_yen integer not null default 0 check (direct_reward_yen >= 0),
  category_reward_count integer not null default 0 check (category_reward_count >= 0),
  category_reward_yen integer not null default 0 check (category_reward_yen >= 0),
  service_reward_count integer not null default 0 check (service_reward_count >= 0),
  service_reward_yen integer not null default 0 check (service_reward_yen >= 0),
  report_status text not null default 'confirmed' check (report_status in ('provisional', 'confirmed')),
  capture_source text not null default 'manual_dmm_ui' check (capture_source in ('manual_dmm_ui', 'manual_csv')),
  notes text not null default '',
  observed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fanza_id990_daily_official_metrics_date_idx
  on public.fanza_id990_daily_official_metrics (report_date desc);

alter table public.fanza_id990_daily_official_metrics enable row level security;
revoke all on table public.fanza_id990_daily_official_metrics from anon, authenticated;
grant all on table public.fanza_id990_daily_official_metrics to service_role;
