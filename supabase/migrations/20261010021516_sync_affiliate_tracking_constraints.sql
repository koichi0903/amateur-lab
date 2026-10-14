-- Keep persisted attribution values aligned with the application enums.
-- These constraints previously rejected valid clicks from listing cards,
-- buy-timing panels, X, discovery, and price-report pages with SQLSTATE 23514.
alter table public.affiliate_clicks
  drop constraint if exists affiliate_clicks_placement_check;

alter table public.affiliate_clicks
  add constraint affiliate_clicks_placement_check
  check (placement in (
    'listing-card',
    'detail-sidebar',
    'buy-timing-panel',
    'mobile-sticky',
    'compare-card',
    'sample-movie-fallback'
  ));

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
    'price-report',
    'discovery',
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

alter table public.affiliate_cta_impressions
  drop constraint if exists affiliate_cta_impressions_source_page_check;

alter table public.affiliate_cta_impressions
  add constraint affiliate_cta_impressions_source_page_check
  check (source_page in (
    'direct',
    'home',
    'ranking',
    'new',
    'sale',
    'deals',
    'price-report',
    'discovery',
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

alter table public.work_page_views
  drop constraint if exists work_page_views_source_page_check;

alter table public.work_page_views
  add constraint work_page_views_source_page_check
  check (source_page in (
    'direct',
    'home',
    'ranking',
    'new',
    'sale',
    'deals',
    'price-report',
    'discovery',
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
