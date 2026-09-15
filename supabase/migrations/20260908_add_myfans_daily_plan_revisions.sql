alter table public.myfans_daily_plans
  add column if not exists revision integer not null default 1,
  add column if not exists evaluated_at timestamptz,
  add column if not exists source_counts_json jsonb not null default '{}'::jsonb;

create index if not exists myfans_daily_plans_media_date_revision_idx
  on public.myfans_daily_plans (approved_media_id, plan_date, revision desc);

revoke all on table public.myfans_daily_plans from anon, authenticated;
