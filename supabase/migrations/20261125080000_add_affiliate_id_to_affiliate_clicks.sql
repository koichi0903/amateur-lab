alter table public.affiliate_clicks
  add column if not exists affiliate_id text;

create index if not exists affiliate_clicks_affiliate_id_clicked_at_idx
  on public.affiliate_clicks (affiliate_id, clicked_at desc)
  where affiliate_id is not null;
