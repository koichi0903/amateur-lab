create table if not exists public.fanza_amateur_api_catalog_run_items (
  run_id uuid not null references public.fanza_amateur_api_catalog_runs(id) on delete cascade,
  content_id text not null,
  range_key text not null,
  primary key (run_id, content_id)
);

create index if not exists fanza_amateur_api_catalog_run_items_range_idx
  on public.fanza_amateur_api_catalog_run_items (run_id, range_key);

alter table public.fanza_amateur_api_catalog_run_items enable row level security;
revoke all privileges on table public.fanza_amateur_api_catalog_run_items from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.fanza_amateur_api_catalog_run_items to service_role;

