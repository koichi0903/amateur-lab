-- Store coarse first-party acquisition context for future FANZA click/sales
-- analysis. No visitor IDs, IPs, user agents, raw referrers, or query values
-- from the referrer are stored.
alter table public.affiliate_clicks
  add column if not exists external_channel text,
  add column if not exists external_source text,
  add column if not exists landing_path text;

alter table public.affiliate_clicks
  drop constraint if exists affiliate_clicks_external_channel_check;

alter table public.affiliate_clicks
  add constraint affiliate_clicks_external_channel_check
  check (
    external_channel is null
    or external_channel in (
      'direct',
      'organic_search',
      'social',
      'referral',
      'internal'
    )
  );

create index if not exists affiliate_clicks_external_channel_clicked_at_idx
  on public.affiliate_clicks (external_channel, clicked_at desc);

create index if not exists affiliate_clicks_external_source_clicked_at_idx
  on public.affiliate_clicks (external_source, clicked_at desc);
