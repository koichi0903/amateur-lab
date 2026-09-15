-- Attribute aggregate X funnel events to the generated post key without
-- storing visitor identifiers.
alter table public.affiliate_clicks
  add column if not exists x_post_key text;

alter table public.affiliate_cta_impressions
  add column if not exists x_post_key text;

alter table public.work_page_views
  add column if not exists x_post_key text;

create index if not exists affiliate_clicks_x_post_key_clicked_at_idx
  on public.affiliate_clicks (x_post_key, clicked_at desc)
  where x_post_key is not null;

create index if not exists affiliate_cta_impressions_x_post_key_viewed_at_idx
  on public.affiliate_cta_impressions (x_post_key, viewed_at desc)
  where x_post_key is not null;

create index if not exists work_page_views_x_post_key_viewed_at_idx
  on public.work_page_views (x_post_key, viewed_at desc)
  where x_post_key is not null;
