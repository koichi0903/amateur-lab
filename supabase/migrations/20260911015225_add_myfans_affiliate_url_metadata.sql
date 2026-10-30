alter table public.myfans_products
  add column if not exists affiliate_url_generated_at timestamptz,
  add column if not exists affiliate_url_expires_at timestamptz,
  add column if not exists affiliate_url_source text not null default '';

create index if not exists myfans_products_affiliate_url_expires_idx
  on public.myfans_products (affiliate_url_expires_at)
  where affiliate_url <> '';

alter table public.myfans_products enable row level security;
revoke all on table public.myfans_products from anon, authenticated;
