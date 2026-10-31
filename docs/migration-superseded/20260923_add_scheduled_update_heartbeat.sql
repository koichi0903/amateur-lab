alter table public.scheduled_update_runs
  add column if not exists heartbeat_at timestamptz;

create index if not exists scheduled_update_runs_running_heartbeat_idx
  on public.scheduled_update_runs (status, heartbeat_at)
  where status = 'running';
