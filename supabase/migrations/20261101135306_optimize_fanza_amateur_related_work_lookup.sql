alter table public.fanza_amateur_entity_works
  drop constraint fanza_amateur_entity_works_kind_check;

alter table public.fanza_amateur_entity_works
  add constraint fanza_amateur_entity_works_kind_check
  check (kind in ('genre', 'maker', 'series'));

insert into public.fanza_amateur_entity_works (kind, name, content_id, api_date)
select distinct
  'series'::text,
  nullif(btrim(entity.value ->> 'name'), ''),
  work.content_id,
  work.api_date
from public.fanza_amateur_works as work
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(work.iteminfo -> 'series') = 'array'
    then work.iteminfo -> 'series' else '[]'::jsonb end
) as entity(value)
where nullif(btrim(entity.value ->> 'name'), '') is not null
on conflict (kind, name, content_id) do nothing;

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
    select 'series'::text as kind, value
    from jsonb_array_elements(
      case when jsonb_typeof(work.iteminfo -> 'series') = 'array'
        then work.iteminfo -> 'series' else '[]'::jsonb end
    ) as value
    union all
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

create or replace function public.get_fanza_amateur_related_work_candidates(
  p_series_names text[],
  p_genre_names text[],
  p_maker_names text[],
  p_per_entity_limit integer default 24
)
returns table (raw_item jsonb)
language sql
stable
set search_path = public
as $$
  with requested_entities as (
    select 'series'::text as kind, requested.name
    from unnest(coalesce(p_series_names, array[]::text[])) as requested(name)
    union
    select 'genre'::text as kind, requested.name
    from unnest(coalesce(p_genre_names, array[]::text[])) as requested(name)
    union
    select 'maker'::text as kind, requested.name
    from unnest(coalesce(p_maker_names, array[]::text[])) as requested(name)
  ),
  ranked_entities as (
    select
      entity.content_id,
      row_number() over (
        partition by entity.kind, entity.name
        order by entity.api_date desc nulls last, entity.content_id asc
      ) as entity_rank
    from public.fanza_amateur_entity_works as entity
    join requested_entities as requested
      on requested.kind = entity.kind
      and requested.name = entity.name
  ),
  candidate_ids as (
    select distinct content_id
    from ranked_entities
    where entity_rank <= greatest(1, least(coalesce(p_per_entity_limit, 24), 24))
  )
  select work.raw_item
  from candidate_ids as candidate
  join public.fanza_amateur_works as work using (content_id)
  where work.raw_item is not null;
$$;

revoke all on function public.get_fanza_amateur_related_work_candidates(text[], text[], text[], integer)
  from public, anon, authenticated, service_role;
grant execute on function public.get_fanza_amateur_related_work_candidates(text[], text[], text[], integer)
  to service_role;

