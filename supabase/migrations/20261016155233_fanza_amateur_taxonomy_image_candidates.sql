alter table public.fanza_amateur_taxonomy
  add column image_candidates jsonb not null default '[]'::jsonb;

create or replace function public.refresh_fanza_amateur_taxonomy()
returns void
language plpgsql
set search_path = public
as $$
begin
  delete from public.fanza_amateur_taxonomy;

  insert into public.fanza_amateur_taxonomy (
    kind, name, work_count, image_url, representative_content_id, image_candidates, refreshed_at
  )
  with expanded as (
    select
      category.kind,
      nullif(btrim(category.value ->> 'name'), '') as name,
      work.content_id,
      work.api_date,
      nullif(coalesce(work.image_url ->> 'large', work.image_url ->> 'small', work.image_url ->> 'list'), '') as image_url
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
    ) as category
    where nullif(btrim(category.value ->> 'name'), '') is not null
  ),
  counts as (
    select kind, name, count(distinct content_id)::integer as work_count
    from expanded
    group by kind, name
  ),
  distinct_covers as (
    select distinct on (kind, name, image_url)
      kind, name, content_id, api_date, image_url
    from expanded
    where image_url is not null
    order by kind, name, image_url, api_date desc nulls last, content_id
  ),
  ranked_covers as (
    select distinct_covers.*,
      row_number() over (
        partition by kind, name
        order by api_date desc nulls last, content_id
      ) as cover_position
    from distinct_covers
  ),
  cover_sets as (
    select
      kind,
      name,
      jsonb_agg(
        jsonb_build_object('contentId', content_id, 'imageUrl', image_url)
        order by cover_position
      ) as image_candidates
    from ranked_covers
    where cover_position <= 8
    group by kind, name
  )
  select
    counts.kind,
    counts.name,
    counts.work_count,
    cover_sets.image_candidates -> 0 ->> 'imageUrl',
    cover_sets.image_candidates -> 0 ->> 'contentId',
    coalesce(cover_sets.image_candidates, '[]'::jsonb),
    now()
  from counts
  left join cover_sets using (kind, name);
end;
$$;

select public.refresh_fanza_amateur_taxonomy();
