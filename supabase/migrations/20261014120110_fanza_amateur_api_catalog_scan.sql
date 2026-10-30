create table public.fanza_amateur_api_catalog_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'running' check (status in ('running', 'completed', 'limit_reached')),
  source_sort text not null default 'date' check (source_sort = 'date'),
  total_count integer check (total_count is null or total_count >= 0),
  next_offset integer not null default 1 check (next_offset between 1 and 50001),
  fetched_item_count integer not null default 0 check (fetched_item_count >= 0),
  observed_item_key_paths text[] not null default '{}',
  last_error text,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index fanza_amateur_api_catalog_one_running_run
  on public.fanza_amateur_api_catalog_runs (status)
  where status = 'running';

create table public.fanza_amateur_api_catalog_items (
  run_id uuid not null references public.fanza_amateur_api_catalog_runs(id) on delete cascade,
  content_id text not null,
  source_offset integer not null check (source_offset between 1 and 50000),
  raw_item jsonb not null check (jsonb_typeof(raw_item) = 'object'),
  fetched_at timestamptz not null default now(),
  primary key (run_id, content_id)
);

create index fanza_amateur_api_catalog_items_run_offset_idx
  on public.fanza_amateur_api_catalog_items (run_id, source_offset);

alter table public.fanza_amateur_api_catalog_runs enable row level security;
alter table public.fanza_amateur_api_catalog_items enable row level security;

revoke all privileges on table public.fanza_amateur_api_catalog_runs from public, anon, authenticated, service_role;
revoke all privileges on table public.fanza_amateur_api_catalog_items from public, anon, authenticated, service_role;
grant select, insert, update on table public.fanza_amateur_api_catalog_runs to service_role;
grant select, insert, update on table public.fanza_amateur_api_catalog_items to service_role;
