create table public.fanza_amateur_works (
  content_id text primary key,
  source_run_id uuid not null references public.fanza_amateur_api_catalog_runs(id) on delete restrict,
  source_offset integer not null check (source_offset between 1 and 50000),
  fetched_at timestamptz not null default now(),
  service_code text,
  service_name text,
  floor_code text,
  floor_name text,
  category_name text,
  product_id text,
  title text,
  volume text,
  review jsonb,
  api_url text,
  affiliate_url text,
  image_url jsonb,
  sample_image_url jsonb,
  sample_movie_url jsonb,
  prices jsonb,
  api_date text,
  iteminfo jsonb,
  campaign jsonb,
  rank integer,
  raw_item jsonb not null check (jsonb_typeof(raw_item) = 'object')
);

create index fanza_amateur_works_source_offset_idx
  on public.fanza_amateur_works (source_run_id, source_offset);

create index fanza_amateur_works_api_date_idx
  on public.fanza_amateur_works (api_date desc);

alter table public.fanza_amateur_works enable row level security;
revoke all privileges on table public.fanza_amateur_works from public, anon, authenticated, service_role;
grant select, insert, update on table public.fanza_amateur_works to service_role;
