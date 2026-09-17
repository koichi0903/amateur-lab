alter table public.myfans_products
  add column if not exists ingest_source text not null default '',
  add column if not exists source_observed_at timestamptz,
  add column if not exists source_metadata jsonb not null default '{}'::jsonb;

alter table public.myfans_post_product_linkage_evidence
  add column if not exists resolution_history jsonb not null default '[]'::jsonb;

create index if not exists myfans_products_ingest_source_idx
  on public.myfans_products (ingest_source, source_observed_at desc);

alter table public.myfans_products enable row level security;
alter table public.myfans_post_product_linkage_evidence enable row level security;
revoke all on table public.myfans_products from anon, authenticated;
revoke all on table public.myfans_post_product_linkage_evidence from anon, authenticated;
