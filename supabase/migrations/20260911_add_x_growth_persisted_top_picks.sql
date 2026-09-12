alter table public.x_growth_daily_plans
  add column if not exists top_picks jsonb not null default '[]'::jsonb,
  add column if not exists supply_diagnostics jsonb not null default '{}'::jsonb,
  add column if not exists native_x_learning jsonb not null default '{}'::jsonb,
  add column if not exists performance_timings jsonb not null default '{}'::jsonb,
  add column if not exists generated_at timestamptz,
  add column if not exists stale_reason text;

create index if not exists x_growth_daily_plans_account_date_idx
  on public.x_growth_daily_plans (account_handle, plan_date desc);
