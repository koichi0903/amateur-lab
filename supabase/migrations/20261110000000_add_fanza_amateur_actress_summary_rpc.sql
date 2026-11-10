create or replace function public.get_fanza_amateur_actress_summary(
  p_name text
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
  with target as (
    select case btrim(p_name)
      when '静河' then '月瀬りりあ'
      else btrim(p_name)
    end as name
    where nullif(btrim(p_name), '') is not null
  ),
  performer_works as (
    select distinct
      target.name as performer_name,
      m.content_id
    from target
    join public.fanza_amateur_performer_matches as m
      on m.performer_name = target.name
      or (target.name = '月瀬りりあ' and m.performer_name = '静河')
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
    join public.fanza_amateur_works as w
      on w.content_id = pw.content_id
     and w.is_listed = true
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
      select
        p.ruby,
        p.birthday,
        p.height_cm,
        p.bust_cm,
        p.waist_cm,
        p.hip_cm,
        p.cup,
        p.image_url_large,
        p.image_url_small
      from public.actress_profiles as p
      where p.name = s.name
      order by
        (p.image_url_large is not null) desc,
        p.updated_at desc nulls last,
        p.dmm_actress_id
      limit 1
    ) as p on true
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
  from enriched as e;
$$;

revoke all on function public.get_fanza_amateur_actress_summary(text) from public, anon, authenticated;
grant execute on function public.get_fanza_amateur_actress_summary(text) to service_role;

