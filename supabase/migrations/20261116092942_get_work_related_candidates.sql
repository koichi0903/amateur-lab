create or replace function public.get_work_related_candidates(
  p_work_id bigint,
  p_actress text,
  p_series text,
  p_genre text,
  p_maker text
)
returns table (
  work jsonb,
  weight integer,
  source_order integer,
  candidate_order bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with candidate_works as (
    (
      select matched.work, matched.weight, 1::integer as source_order, matched.candidate_order
      from (
        select w as work, 45::integer as weight,
          row_number() over (order by w.score desc nulls last) as candidate_order
        from public.works as w
        where p_series is not null
          and p_series <> ''
          and w.series ilike '%' || p_series || '%'
          and w.id <> p_work_id
        order by w.score desc nulls last
        limit 18
      ) as matched
    )
    union all
    (
      select matched.work, matched.weight, 2::integer as source_order, matched.candidate_order
      from (
        select w as work, 40::integer as weight,
          row_number() over (order by w.score desc nulls last) as candidate_order
        from public.works as w
        where p_actress is not null
          and p_actress <> ''
          and w.actress ilike '%' || p_actress || '%'
          and w.id <> p_work_id
        order by w.score desc nulls last
        limit 18
      ) as matched
    )
    union all
    (
      select matched.work, matched.weight, 3::integer as source_order, matched.candidate_order
      from (
        select w as work, 25::integer as weight,
          row_number() over (order by w.score desc nulls last) as candidate_order
        from public.works as w
        where p_genre is not null
          and p_genre <> ''
          and w.genre ilike '%' || p_genre || '%'
          and w.id <> p_work_id
        order by w.score desc nulls last
        limit 18
      ) as matched
    )
    union all
    (
      select matched.work, matched.weight, 4::integer as source_order, matched.candidate_order
      from (
        select w as work, 15::integer as weight,
          row_number() over (order by w.score desc nulls last) as candidate_order
        from public.works as w
        where p_maker is not null
          and p_maker <> ''
          and w.maker ilike '%' || p_maker || '%'
          and w.id <> p_work_id
        order by w.score desc nulls last
        limit 18
      ) as matched
    )
  )
  select
    jsonb_build_object(
      'id', (candidate.work).id,
      'product_id', (candidate.work).product_id,
      'title', (candidate.work).title,
      'actress', (candidate.work).actress,
      'genre', (candidate.work).genre,
      'maker', (candidate.work).maker,
      'series', (candidate.work).series,
      'image_url', (candidate.work).image_url,
      'score', (candidate.work).score,
      'review_average', (candidate.work).review_average,
      'review_count', (candidate.work).review_count,
      'price', (candidate.work).price,
      'sale_price', (candidate.work).sale_price,
      'list_price', (candidate.work).list_price,
      'discount_rate', (candidate.work).discount_rate,
      'sale_end_at', (candidate.work).sale_end_at,
      'affiliate_url', (candidate.work).affiliate_url,
      'stage', (candidate.work).stage
    ),
    candidate.weight,
    candidate.source_order,
    candidate.candidate_order
  from candidate_works as candidate
  order by candidate.source_order, candidate.candidate_order;
$$;

revoke all on function public.get_work_related_candidates(bigint, text, text, text, text)
  from public;
grant execute on function public.get_work_related_candidates(bigint, text, text, text, text)
  to anon, authenticated, service_role;
