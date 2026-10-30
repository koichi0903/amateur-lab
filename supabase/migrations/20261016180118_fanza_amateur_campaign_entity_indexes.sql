create table public.fanza_amateur_entity_works (
  kind text not null check (kind in ('genre', 'maker')),
  name text not null,
  content_id text not null references public.fanza_amateur_works(content_id) on delete cascade,
  api_date text,
  primary key (kind, name, content_id)
);

create index fanza_amateur_entity_works_page_idx
  on public.fanza_amateur_entity_works (kind, name, api_date desc nulls last, content_id);

create index fanza_amateur_entity_works_work_idx
  on public.fanza_amateur_entity_works (content_id);

alter table public.fanza_amateur_entity_works enable row level security;
revoke all privileges on table public.fanza_amateur_entity_works from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.fanza_amateur_entity_works to service_role;

create table public.fanza_amateur_campaigns (
  content_id text not null references public.fanza_amateur_works(content_id) on delete cascade,
  campaign_index smallint not null check (campaign_index >= 1),
  title text not null default '',
  starts_at timestamptz,
  ends_at timestamptz,
  primary key (content_id, campaign_index),
  check (starts_at is not null or ends_at is not null)
);

create index fanza_amateur_campaigns_active_start_idx
  on public.fanza_amateur_campaigns (starts_at, ends_at, content_id);

create index fanza_amateur_campaigns_active_end_idx
  on public.fanza_amateur_campaigns (ends_at, starts_at, content_id);

alter table public.fanza_amateur_campaigns enable row level security;
revoke all privileges on table public.fanza_amateur_campaigns from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.fanza_amateur_campaigns to service_role;

create or replace function public.refresh_fanza_amateur_entity_works()
returns void
language sql
set search_path = public
as $$
  delete from public.fanza_amateur_entity_works;
  insert into public.fanza_amateur_entity_works (kind, name, content_id, api_date)
  select distinct
    entity.kind,
    nullif(btrim(entity.value ->> 'name'), ''),
    work.content_id,
    work.api_date
  from public.fanza_amateur_works as work
  cross join lateral (
    select 'genre'::text as kind, value
    from jsonb_array_elements(
      case when jsonb_typeof(work.iteminfo -> 'genre') = 'array'
        then work.iteminfo -> 'genre' else '[]'::jsonb end
    ) as value
    union all
    select 'maker'::text as kind, value
    from jsonb_array_elements(
      case when jsonb_typeof(work.iteminfo -> 'maker') = 'array'
        then work.iteminfo -> 'maker' else '[]'::jsonb end
    ) as value
  ) as entity
  where nullif(btrim(entity.value ->> 'name'), '') is not null;
$$;

revoke all on function public.refresh_fanza_amateur_entity_works() from public, anon, authenticated, service_role;
grant execute on function public.refresh_fanza_amateur_entity_works() to service_role;

create or replace function public.refresh_fanza_amateur_campaigns()
returns void
language sql
set search_path = public
as $$
  delete from public.fanza_amateur_campaigns;
  insert into public.fanza_amateur_campaigns (content_id, campaign_index, title, starts_at, ends_at)
  select
    work.content_id,
    campaign.ordinality::smallint,
    coalesce(campaign.value ->> 'title', ''),
    case
      when campaign.value ->> 'date_begin' ~ '^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$'
      then ((campaign.value ->> 'date_begin')::timestamp at time zone 'Asia/Tokyo')
      else null
    end,
    case
      when campaign.value ->> 'date_end' ~ '^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$'
      then ((campaign.value ->> 'date_end')::timestamp at time zone 'Asia/Tokyo')
      else null
    end
  from public.fanza_amateur_works as work
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(work.campaign) = 'array'
      then work.campaign else '[]'::jsonb end
  ) with ordinality as campaign(value, ordinality)
  where jsonb_typeof(work.campaign) = 'array'
    and (campaign.value ->> 'date_begin' ~ '^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$'
      or campaign.value ->> 'date_end' ~ '^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$');
$$;

revoke all on function public.refresh_fanza_amateur_campaigns() from public, anon, authenticated, service_role;
grant execute on function public.refresh_fanza_amateur_campaigns() to service_role;

create or replace function public.refresh_fanza_amateur_taxonomy_after_catalog_run()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform public.refresh_fanza_amateur_taxonomy();
  perform public.refresh_fanza_amateur_entity_works();
  perform public.refresh_fanza_amateur_campaigns();
  return new;
end;
$$;

select public.refresh_fanza_amateur_taxonomy();
select public.refresh_fanza_amateur_entity_works();
select public.refresh_fanza_amateur_campaigns();
