create table public.fanza_amateur_mp4_runs (
  id uuid primary key default gen_random_uuid(),
  run_type text not null check (run_type in ('daily_incremental', 'weekly_full')),
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  target_count integer not null default 0 check (target_count >= 0),
  processed_count integer not null default 0 check (processed_count >= 0),
  found_count integer not null default 0 check (found_count >= 0),
  no_video_count integer not null default 0 check (no_video_count >= 0),
  failed_attempt_count integer not null default 0 check (failed_attempt_count >= 0),
  last_error text,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index fanza_amateur_mp4_one_running_run
  on public.fanza_amateur_mp4_runs (status)
  where status = 'running';

alter table public.fanza_amateur_works
  add column mp4_url text,
  add column mp4_status text not null default 'pending'
    check (mp4_status in ('pending', 'found', 'no_video')),
  add column mp4_attempt_count smallint not null default 0
    check (mp4_attempt_count between 0 and 3),
  add column mp4_last_attempt_run_id uuid
    references public.fanza_amateur_mp4_runs(id) on delete set null,
  add column mp4_checked_at timestamptz,
  add column mp4_last_error text,
  add constraint fanza_amateur_works_mp4_state_check check (
    (mp4_status = 'found' and mp4_url is not null)
    or (mp4_status <> 'found' and mp4_url is null)
  );

create index fanza_amateur_works_mp4_pending_idx
  on public.fanza_amateur_works (api_date desc, content_id)
  where is_listed = true and mp4_status = 'pending' and mp4_attempt_count < 3;

alter table public.fanza_amateur_mp4_runs enable row level security;
revoke all privileges on table public.fanza_amateur_mp4_runs from public, anon, authenticated, service_role;
grant select, insert, update on table public.fanza_amateur_mp4_runs to service_role;
