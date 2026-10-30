create table public.fanza_amateur_catalog_pages (
  sort_key text not null check (sort_key in ('rank', 'date', 'review', 'price', '-price')),
  page_number integer not null check (page_number between 1 and 2084),
  page_size integer not null check (page_size = 24),
  total_count integer not null check (total_count >= 0),
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  fetched_at timestamptz not null default now(),
  primary key (sort_key, page_number)
);

alter table public.fanza_amateur_catalog_pages enable row level security;

grant select, insert, update on table public.fanza_amateur_catalog_pages to service_role;
