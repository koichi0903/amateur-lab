alter table public.affiliate_clicks
  alter column work_id drop not null;

alter table public.affiliate_clicks
  add column guide_slug text,
  add column guide_cta_key text;

alter table public.affiliate_clicks
  drop constraint affiliate_clicks_placement_check,
  add constraint affiliate_clicks_placement_check
    check (
      placement = any (
        array[
          'listing-card',
          'detail-sidebar',
          'buy-timing-panel',
          'mobile-sticky',
          'compare-card',
          'sample-movie-fallback',
          'guide-cta'
        ]::text[]
      )
    );

alter table public.affiliate_clicks
  drop constraint affiliate_clicks_source_page_check,
  add constraint affiliate_clicks_source_page_check
    check (
      source_page = any (
        array[
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
          'x',
          'guides'
        ]::text[]
      )
    );

alter table public.affiliate_clicks
  add constraint affiliate_clicks_guide_slug_check
    check (guide_slug is null or guide_slug ~ '^[a-z0-9-]{1,80}$'),
  add constraint affiliate_clicks_guide_cta_key_check
    check (guide_cta_key is null or guide_cta_key ~ '^[a-z0-9-]{1,80}$'),
  add constraint affiliate_clicks_guide_attribution_check
    check (
      placement <> 'guide-cta'
      or (
        work_id is null
        and source_page = 'guides'
        and guide_slug is not null
        and guide_cta_key is not null
      )
    );
