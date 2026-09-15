create table if not exists public.work_page_views (
  id bigint generated always as identity primary key,
  work_id bigint not null references public.works(id) on delete cascade,
  source_page text not null check (source_page in (
    'direct', 'home', 'ranking', 'new', 'sale', 'deals', 'features',
    'comparison', 'search', 'favorites', 'actress', 'genre', 'maker',
    'series', 'related', 'x'
  )),
  price integer,
  discount_rate integer,
  discovery_score numeric,
  ranking integer,
  x_post_key text,
  external_channel text,
  external_source text,
  landing_path text,
  viewed_at timestamptz not null default now()
);

create index if not exists work_page_views_viewed_at_idx
  on public.work_page_views (viewed_at desc);

create index if not exists work_page_views_work_id_viewed_at_idx
  on public.work_page_views (work_id, viewed_at desc);

create index if not exists work_page_views_source_page_viewed_at_idx
  on public.work_page_views (source_page, viewed_at desc);

alter table public.work_page_views enable row level security;

revoke all on table public.work_page_views from anon, authenticated;
revoke all on sequence public.work_page_views_id_seq from anon, authenticated;
