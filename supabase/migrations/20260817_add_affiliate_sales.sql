-- Store monthly FANZA product-report totals without visitor identifiers.
-- Re-importing the same month/product updates the existing row instead of
-- double-counting it.

alter table public.affiliate_clicks
  drop constraint if exists affiliate_clicks_source_page_check;

alter table public.affiliate_clicks
  add constraint affiliate_clicks_source_page_check
  check (source_page in (
    'direct', 'home', 'ranking', 'new', 'sale', 'search', 'favorites',
    'actress', 'genre', 'maker', 'series', 'related', 'deals', 'features',
    'comparison'
  ));

create table if not exists public.affiliate_sales (
  id bigint generated always as identity primary key,
  report_month date not null,
  work_id bigint references public.works(id) on delete set null,
  product_id text not null default '',
  title text not null,
  sales_count integer not null default 0,
  sales_amount integer not null default 0,
  commission_amount integer not null default 0,
  source_file text not null default '',
  row_key text not null unique,
  imported_at timestamptz not null default now()
);

create index if not exists affiliate_sales_report_month_idx
  on public.affiliate_sales (report_month desc);

create index if not exists affiliate_sales_work_id_idx
  on public.affiliate_sales (work_id)
  where work_id is not null;

alter table public.affiliate_sales enable row level security;

-- Revenue data is private and only available to service-role admin code.
revoke all on table public.affiliate_sales from anon, authenticated;
revoke all on sequence public.affiliate_sales_id_seq from anon, authenticated;
