-- Aggregate catalog index data inside Postgres so Vercel does not download
-- every work row whenever the one-hour entity index cache is refreshed.
drop function if exists public.get_entity_index_summaries();

create function public.get_entity_index_summaries()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with entity_rows as (
    select 'actress'::text as kind, btrim(value) as name, w.score, w.image_url
    from public.works w
    cross join lateral unnest(string_to_array(coalesce(w.actress, ''), ' / ')) value

    union all

    select 'genre'::text, btrim(value), w.score, w.image_url
    from public.works w
    cross join lateral unnest(string_to_array(coalesce(w.genre, ''), ' / ')) value

    union all

    select 'maker'::text, btrim(w.maker), w.score, w.image_url
    from public.works w

    union all

    select 'series'::text, btrim(w.series), w.score, w.image_url
    from public.works w
  ),
  ranked as (
    select
      kind,
      name,
      count(*) over (partition by kind, name) as work_count,
      max(coalesce(score, 0)) over (partition by kind, name) as max_score,
      first_value(image_url) over (
        partition by kind, name
        order by coalesce(score, 0) desc, image_url nulls last
      ) as image_url,
      row_number() over (
        partition by kind, name
        order by coalesce(score, 0) desc, image_url nulls last
      ) as row_number
    from entity_rows
    where name is not null and name <> ''
  )
  select jsonb_object_agg(kind, summaries)
  from (
    select
      kind,
      jsonb_agg(
        jsonb_build_object(
          'name', name,
          'work_count', work_count,
          'max_score', max_score,
          'image_url', image_url
        )
        order by work_count desc, max_score desc, name
      ) as summaries
    from ranked
    where row_number = 1
    group by kind
  ) grouped;
$$;

revoke all on function public.get_entity_index_summaries() from public;
grant execute on function public.get_entity_index_summaries() to anon, authenticated;
