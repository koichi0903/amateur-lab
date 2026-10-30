create index if not exists fanza_amateur_performer_matches_confirmed_name_content_idx
  on public.fanza_amateur_performer_matches (performer_name, content_id)
  where verification_status = 'confirmed';

create or replace function public.get_fanza_amateur_actress_index(
  p_query text default null,
  p_sort text default 'count-desc',
  p_offset integer default 0,
  p_limit integer default 24
)
returns table (
  name text,
  work_count bigint,
  image_url text,
  profile_image_url text,
  ruby text,
  birthday date,
  height_cm numeric,
  bust_cm numeric,
  waist_cm numeric,
  hip_cm numeric,
  cup text,
  total_count bigint
)
language sql
stable
set search_path = public, pg_temp
as $$
  with performer_works as (
    select distinct m.performer_name, m.content_id
    from public.fanza_amateur_performer_matches as m
    join public.fanza_amateur_works as w
      on w.content_id = m.content_id
     and w.is_listed = true
    where m.verification_status = 'confirmed'
  ),
  actress_stats as (
    select
      pw.performer_name as name,
      count(*)::bigint as work_count,
      (array_agg(
        coalesce(
          nullif(w.image_url ->> 'large', ''),
          nullif(w.image_url ->> 'small', ''),
          nullif(w.image_url ->> 'list', ''),
          nullif(w.raw_item #>> '{imageURL,large}', ''),
          nullif(w.raw_item #>> '{imageURL,small}', '')
        )
        order by w.api_date desc nulls last, w.content_id
      ) filter (where coalesce(
        nullif(w.image_url ->> 'large', ''),
        nullif(w.image_url ->> 'small', ''),
        nullif(w.image_url ->> 'list', ''),
        nullif(w.raw_item #>> '{imageURL,large}', ''),
        nullif(w.raw_item #>> '{imageURL,small}', '')
      ) is not null))[1] as image_url
    from performer_works as pw
    join public.fanza_amateur_works as w on w.content_id = pw.content_id
    group by pw.performer_name
  ),
  enriched as (
    select
      s.name,
      s.work_count,
      s.image_url,
      coalesce(nullif(p.image_url_large, ''), nullif(p.image_url_small, '')) as profile_image_url,
      p.ruby,
      p.birthday,
      p.height_cm,
      p.bust_cm,
      p.waist_cm,
      p.hip_cm,
      p.cup
    from actress_stats as s
    left join lateral (
      select p.ruby, p.birthday, p.height_cm, p.bust_cm, p.waist_cm, p.hip_cm, p.cup,
        p.image_url_large, p.image_url_small
      from public.actress_profiles as p
      where p.name = s.name
      order by (p.image_url_large is not null) desc, p.updated_at desc nulls last, p.dmm_actress_id
      limit 1
    ) as p on true
    where nullif(btrim(p_query), '') is null
       or s.name ilike '%' || btrim(p_query) || '%'
       or coalesce(p.ruby, '') ilike '%' || btrim(p_query) || '%'
  )
  select
    e.name,
    e.work_count,
    e.image_url,
    e.profile_image_url,
    e.ruby,
    e.birthday,
    e.height_cm,
    e.bust_cm,
    e.waist_cm,
    e.hip_cm,
    e.cup,
    count(*) over() as total_count
  from enriched as e
  order by
    case when nullif(btrim(p_query), '') is not null and e.name = btrim(p_query) then 0 else 1 end,
    case when p_sort = 'count-desc' then e.work_count end desc nulls last,
    case when p_sort = 'count-asc' then e.work_count end asc nulls last,
    case when p_sort = 'birthday-asc' then e.birthday end asc nulls last,
    case when p_sort = 'birthday-desc' then e.birthday end desc nulls last,
    case when p_sort = 'height-asc' then e.height_cm end asc nulls last,
    case when p_sort = 'height-desc' then e.height_cm end desc nulls last,
    case when p_sort = 'bust-asc' then e.bust_cm end asc nulls last,
    case when p_sort = 'bust-desc' then e.bust_cm end desc nulls last,
    case when p_sort = 'waist-asc' then e.waist_cm end asc nulls last,
    case when p_sort = 'waist-desc' then e.waist_cm end desc nulls last,
    case when p_sort = 'hip-asc' then e.hip_cm end asc nulls last,
    case when p_sort = 'hip-desc' then e.hip_cm end desc nulls last,
    case when p_sort = 'cup-asc' then ascii(upper(left(e.cup, 1))) end asc nulls last,
    case when p_sort = 'cup-desc' then ascii(upper(left(e.cup, 1))) end desc nulls last,
    e.name asc
  limit least(greatest(coalesce(p_limit, 24), 1), 48)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.get_fanza_amateur_actress_works(
  p_name text,
  p_offset integer default 0,
  p_limit integer default 60,
  p_sort text default 'newest'
)
returns table (
  raw_item jsonb,
  fetched_at timestamptz,
  image_url jsonb,
  sample_image_url jsonb,
  confirmed_performers text[],
  total_count bigint
)
language sql
stable
set search_path = public, pg_temp
as $$
  with performer_works as (
    select distinct m.content_id
    from public.fanza_amateur_performer_matches as m
    join public.fanza_amateur_works as w
      on w.content_id = m.content_id
     and w.is_listed = true
    where m.verification_status = 'confirmed'
      and m.performer_name = p_name
  ),
  work_count as (
    select count(*)::bigint as total_count from performer_works
  ),
  page as (
    select w.content_id, w.raw_item, w.fetched_at, w.image_url, w.sample_image_url
    from performer_works as pw
    join public.fanza_amateur_works as w on w.content_id = pw.content_id
    order by
      case when p_sort = 'review' and coalesce(w.raw_item #>> '{review,average}', '') ~ '^[0-9]+([.][0-9]+)?$'
        then (w.raw_item #>> '{review,average}')::numeric end desc nulls last,
      case when p_sort = 'review' and coalesce(w.raw_item #>> '{review,count}', '') ~ '^[0-9]+$'
        then (w.raw_item #>> '{review,count}')::bigint end desc nulls last,
      case when p_sort <> 'review' then w.api_date end desc nulls last,
      w.content_id asc
    limit least(greatest(coalesce(p_limit, 60), 1), 300)
    offset greatest(coalesce(p_offset, 0), 0)
  )
  select
    page.raw_item,
    page.fetched_at,
    page.image_url,
    page.sample_image_url,
    array(
      select distinct m.performer_name
      from public.fanza_amateur_performer_matches as m
      where m.content_id = page.content_id
        and m.verification_status = 'confirmed'
      order by m.performer_name
    ) as confirmed_performers,
    work_count.total_count
  from page
  cross join work_count;
$$;

revoke all on function public.get_fanza_amateur_actress_index(text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.get_fanza_amateur_actress_works(text, integer, integer, text) from public, anon, authenticated;
grant execute on function public.get_fanza_amateur_actress_index(text, text, integer, integer) to service_role;
grant execute on function public.get_fanza_amateur_actress_works(text, integer, integer, text) to service_role;
