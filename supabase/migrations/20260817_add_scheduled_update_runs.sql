create table if not exists public.scheduled_update_runs (
  run_id uuid primary key,
  schedule_group text not null check (
    schedule_group in ('daily-0030', 'daily-1030', 'tue-fri-1800', 'sunday-1800')
  ),
  status text not null check (status in ('running', 'completed', 'failed', 'skipped')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error_message text,
  log_file text
);

create index if not exists scheduled_update_runs_group_started_idx
  on public.scheduled_update_runs (schedule_group, started_at desc);

alter table public.scheduled_update_runs enable row level security;
revoke all on table public.scheduled_update_runs from anon, authenticated;

comment on table public.scheduled_update_runs is
  'Windows scheduled task execution history. Service-role access only.';
