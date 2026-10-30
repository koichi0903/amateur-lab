alter table public.fanza_amateur_api_catalog_runs
  drop constraint if exists fanza_amateur_api_catalog_runs_status_check;

alter table public.fanza_amateur_api_catalog_runs
  add constraint fanza_amateur_api_catalog_runs_status_check
  check (status in ('running', 'completed', 'limit_reached', 'needs_attention', 'failed'));

alter table public.fanza_amateur_api_catalog_runs
  add column if not exists run_type text not null default 'weekly_full'
    check (run_type in ('daily_incremental', 'weekly_full')),
  add column if not exists pending_ranges jsonb not null default '[]'::jsonb
    check (jsonb_typeof(pending_ranges) = 'array'),
  add column if not exists current_range jsonb
    check (current_range is null or jsonb_typeof(current_range) = 'object'),
  add column if not exists expected_item_count integer not null default 0
    check (expected_item_count >= 0),
  add column if not exists completed_range_count integer not null default 0
    check (completed_range_count >= 0),
  add column if not exists range_count integer not null default 0
    check (range_count >= 0);

alter table public.fanza_amateur_works
  add column if not exists is_listed boolean not null default true,
  add column if not exists last_seen_at timestamptz not null default now(),
  add column if not exists missing_since timestamptz;

create unique index if not exists fanza_amateur_api_catalog_one_running_run
  on public.fanza_amateur_api_catalog_runs (status)
  where status = 'running';
