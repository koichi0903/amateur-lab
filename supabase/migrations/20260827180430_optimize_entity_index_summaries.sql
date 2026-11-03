create or replace function public.get_entity_index_summaries()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with entity_rows as materialized (
    select 'actress'::text as kind, btrim(value) as name, w.score, w.image_url
    from public.works as w
    cross join lateral unnest(string_to_array(coalesce(w.actress, ''), ' / ')) as value
    where coalesce(w.stage, '') <> 'DISCONTINUED'

    union all

    select 'genre'::text, btrim(value), w.score, w.image_url
    from public.works as w
    cross join lateral unnest(string_to_array(coalesce(w.genre, ''), ' / ')) as value
    where coalesce(w.stage, '') <> 'DISCONTINUED'

    union all

    select 'maker'::text, btrim(w.maker), w.score, w.image_url
    from public.works as w
    where coalesce(w.stage, '') <> 'DISCONTINUED'

    union all

    select 'series'::text, btrim(w.series), w.score, w.image_url
    from public.works as w
    where coalesce(w.stage, '') <> 'DISCONTINUED'
  ),
  valid_rows as materialized (
    select kind, name, score, image_url
    from entity_rows
    where name is not null and name <> ''
  ),
  aggregated as (
    select kind, name, count(*) as work_count, max(coalesce(score, 0)) as max_score
    from valid_rows
    group by kind, name
  ),
  top_images as (
    select distinct on (kind, name)
      kind,
      name,
      image_url
    from valid_rows
    order by kind, name, coalesce(score, 0) desc, image_url nulls last
  ),
  summaries as (
    select
      aggregated.kind,
      jsonb_agg(
        jsonb_build_object(
          'name', aggregated.name,
          'work_count', aggregated.work_count,
          'max_score', aggregated.max_score,
          'image_url', top_images.image_url
        )
        order by aggregated.work_count desc, aggregated.max_score desc, aggregated.name
      ) as items
    from aggregated
    join top_images using (kind, name)
    group by aggregated.kind
  )
  select coalesce(jsonb_object_agg(kind, items), '{}'::jsonb)
  from summaries;
$$;

revoke execute on function public.get_entity_index_summaries() from public;
grant execute on function public.get_entity_index_summaries() to anon, authenticated;
