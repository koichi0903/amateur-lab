create table if not exists public.push_subscriptions (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  user_agent text,
  active boolean not null default true,
  last_error_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.push_price_alerts (
  endpoint text not null references public.push_subscriptions(endpoint) on delete cascade,
  work_id bigint not null references public.works(id) on delete cascade,
  last_notified_price numeric,
  created_at timestamptz not null default now(),
  primary key (endpoint, work_id)
);

create table if not exists public.push_series_alerts (
  endpoint text not null references public.push_subscriptions(endpoint) on delete cascade,
  alert_type text not null check (alert_type in ('actress', 'maker')),
  series_name text not null,
  created_at timestamptz not null default now(),
  primary key (endpoint, alert_type, series_name)
);

create index if not exists push_price_alerts_work_id_idx on public.push_price_alerts(work_id);
create index if not exists push_series_alerts_type_name_idx on public.push_series_alerts(alert_type, series_name);

create table if not exists public.push_series_alert_deliveries (
  endpoint text not null references public.push_subscriptions(endpoint) on delete cascade,
  alert_type text not null check (alert_type in ('actress', 'maker')),
  series_name text not null,
  work_id bigint not null references public.works(id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (endpoint, alert_type, series_name, work_id)
);

create index if not exists push_series_alert_deliveries_work_id_idx on public.push_series_alert_deliveries(work_id);

alter table public.push_subscriptions enable row level security;
alter table public.push_price_alerts enable row level security;
alter table public.push_series_alerts enable row level security;
alter table public.push_series_alert_deliveries enable row level security;

revoke all on table public.push_subscriptions from anon, authenticated;
revoke all on table public.push_price_alerts from anon, authenticated;
revoke all on table public.push_series_alerts from anon, authenticated;
revoke all on table public.push_series_alert_deliveries from anon, authenticated;

create or replace function public.set_push_subscriptions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists push_subscriptions_updated_at on public.push_subscriptions;
create trigger push_subscriptions_updated_at
before update on public.push_subscriptions
for each row execute function public.set_push_subscriptions_updated_at();
