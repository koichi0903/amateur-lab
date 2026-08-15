-- Attribute aggregate affiliate clicks to an internal discovery page without
-- storing referrers, cookies, user agents, IP addresses, or visitor IDs.
alter table public.affiliate_clicks
  add column if not exists source_page text not null default 'direct';

alter table public.affiliate_clicks
  drop constraint if exists affiliate_clicks_source_page_check;

alter table public.affiliate_clicks
  add constraint affiliate_clicks_source_page_check
  check (source_page in (
    'direct', 'home', 'ranking', 'new', 'sale', 'search', 'favorites',
    'actress', 'genre', 'maker', 'series', 'related'
  ));

create index if not exists affiliate_clicks_source_page_clicked_at_idx
  on public.affiliate_clicks (source_page, clicked_at desc);
