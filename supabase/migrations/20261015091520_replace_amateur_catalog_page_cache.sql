create or replace function public.get_fanza_amateur_works_page(
  p_page integer default 1,
  p_sort text default 'date'
)
returns table (
  raw_item jsonb,
  fetched_at timestamptz,
  total_count bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    work.raw_item,
    work.fetched_at,
    count(*) over () as total_count
  from public.fanza_amateur_works as work
  order by
    case when p_sort = 'review' and work.review->>'count' ~ '^[0-9]+$'
      then (work.review->>'count')::numeric end desc nulls last,
    case when p_sort = 'review' and work.review->>'average' ~ '^[0-9]+(\.[0-9]+)?$'
      then (work.review->>'average')::numeric end desc nulls last,
    case when p_sort = 'price' then substring(work.prices->>'price' from '^[^0-9]*([0-9]+)')::numeric end asc nulls last,
    case when p_sort = '-price' then substring(work.prices->>'price' from '^[^0-9]*([0-9]+)')::numeric end desc nulls last,
    case when p_sort = 'date' or p_sort not in ('review', 'price', '-price') then work.api_date end desc nulls last,
    work.content_id asc
  offset (greatest(coalesce(p_page, 1), 1) - 1) * 24
  limit 24;
$$;

revoke all on function public.get_fanza_amateur_works_page(integer, text) from public, anon, authenticated;
grant execute on function public.get_fanza_amateur_works_page(integer, text) to service_role;

drop table public.fanza_amateur_catalog_pages;
