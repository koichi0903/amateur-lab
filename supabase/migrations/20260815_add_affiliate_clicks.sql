-- Aggregate conversion-path measurement without storing IP addresses, referrers,
-- user agents, cookies, or other visitor identifiers.
create table if not exists public.affiliate_clicks (
  id bigint generated always as identity primary key,
  work_id bigint not null references public.works(id) on delete cascade,
  placement text not null check (placement in ('detail-sidebar', 'mobile-sticky')),
  clicked_at timestamptz not null default now()
);

create index if not exists affiliate_clicks_clicked_at_idx
  on public.affiliate_clicks (clicked_at desc);

create index if not exists affiliate_clicks_work_id_clicked_at_idx
  on public.affiliate_clicks (work_id, clicked_at desc);

alter table public.affiliate_clicks enable row level security;

-- Only service-role application code can write or read click events.
revoke all on table public.affiliate_clicks from anon, authenticated;
revoke all on sequence public.affiliate_clicks_id_seq from anon, authenticated;
