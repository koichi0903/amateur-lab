-- Track clicks from the official-player fallback shown when an MP4 cannot be embedded.
alter table public.affiliate_clicks
  drop constraint if exists affiliate_clicks_placement_check;

alter table public.affiliate_clicks
  add constraint affiliate_clicks_placement_check
  check (placement in (
    'detail-sidebar',
    'mobile-sticky',
    'compare-card',
    'sample-movie-fallback'
  ));
