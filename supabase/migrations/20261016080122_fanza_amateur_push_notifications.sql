create table if not exists public.push_amateur_price_alerts (
  endpoint text not null references public.push_subscriptions(endpoint) on delete cascade,
  content_id text not null check (length(content_id) between 1 and 160),
  last_notified_price numeric,
  created_at timestamptz not null default now(),
  primary key (endpoint, content_id)
);

create table if not exists public.push_amateur_maker_alerts (
  endpoint text not null references public.push_subscriptions(endpoint) on delete cascade,
  maker_name text not null check (length(maker_name) between 1 and 200),
  created_at timestamptz not null default now(),
  primary key (endpoint, maker_name)
);

create table if not exists public.push_amateur_maker_alert_deliveries (
  endpoint text not null references public.push_subscriptions(endpoint) on delete cascade,
  maker_name text not null,
  content_id text not null,
  sent_at timestamptz not null default now(),
  primary key (endpoint, maker_name, content_id)
);

create index if not exists push_amateur_price_alerts_content_id_idx
  on public.push_amateur_price_alerts (content_id);

create index if not exists push_amateur_maker_alerts_name_idx
  on public.push_amateur_maker_alerts (maker_name);

create index if not exists push_amateur_maker_alert_deliveries_content_id_idx
  on public.push_amateur_maker_alert_deliveries (content_id);

alter table public.push_amateur_price_alerts enable row level security;
alter table public.push_amateur_maker_alerts enable row level security;
alter table public.push_amateur_maker_alert_deliveries enable row level security;

revoke all privileges on table public.push_amateur_price_alerts from public, anon, authenticated, service_role;
revoke all privileges on table public.push_amateur_maker_alerts from public, anon, authenticated, service_role;
revoke all privileges on table public.push_amateur_maker_alert_deliveries from public, anon, authenticated, service_role;

grant select, insert, update, delete on table public.push_amateur_price_alerts to service_role;
grant select, insert, update, delete on table public.push_amateur_maker_alerts to service_role;
grant select, insert, update, delete on table public.push_amateur_maker_alert_deliveries to service_role;
