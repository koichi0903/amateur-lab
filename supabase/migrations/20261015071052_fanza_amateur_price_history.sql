create table public.fanza_amateur_price_history (
  source_run_id uuid not null references public.fanza_amateur_api_catalog_runs(id) on delete cascade,
  content_id text not null,
  observed_at timestamptz not null,
  price_type text not null check (length(btrim(price_type)) > 0),
  price text,
  list_price text,
  price_data jsonb not null default '{}'::jsonb,
  primary key (source_run_id, content_id, price_type)
);

create index fanza_amateur_price_history_work_observed_idx
  on public.fanza_amateur_price_history (content_id, observed_at desc, price_type);

alter table public.fanza_amateur_price_history enable row level security;
revoke all privileges on table public.fanza_amateur_price_history from public, anon, authenticated, service_role;
grant select, insert, update on table public.fanza_amateur_price_history to service_role;
