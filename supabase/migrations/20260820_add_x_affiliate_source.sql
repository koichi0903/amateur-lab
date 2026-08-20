-- Keep source_page validation in sync with the app-side AffiliateSource union.
-- This enables X post links (?from=x) and newer discovery pages to be tracked.
alter table public.affiliate_clicks
  drop constraint if exists affiliate_clicks_source_page_check;

alter table public.affiliate_clicks
  add constraint affiliate_clicks_source_page_check
  check (source_page in (
    'direct',
    'home',
    'ranking',
    'new',
    'sale',
    'deals',
    'features',
    'comparison',
    'search',
    'favorites',
    'actress',
    'genre',
    'maker',
    'series',
    'related',
    'x'
  ));
