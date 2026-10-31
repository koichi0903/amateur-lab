create or replace function public.get_entity_works_page(
  p_kind text,
  p_name text,
  p_offset integer default 0,
  p_limit integer default 60
)
returns table (
  id bigint,
  title text,
  image_url text,
  score bigint,
  review_average numeric,
  review_count integer,
  price integer,
  sale_price integer,
  discount_rate integer,
  actress text,
  genre text,
  maker text,
  series text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    w.id,
    w.title,
    w.image_url,
    w.score,
    w.review_average,
    w.review_count,
    w.price,
    w.sale_price,
    w.discount_rate,
    w.actress,
    w.genre,
    w.maker,
    w.series
  from private.catalog_entity_works as entity
  join public.works as w on w.id = entity.work_id
  where entity.kind = p_kind
    and entity.name = p_name
  order by entity.score desc nulls last, entity.work_id
  offset greatest(p_offset, 0)
  limit least(greatest(p_limit, 1), 300);
$$;

create or replace function public.get_entity_index_summaries()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    (select payload from private.entity_index_summary_cache where singleton),
    '{}'::jsonb
  );
$$;

revoke execute on function public.get_entity_works_page(text, text, integer, integer) from public;
grant execute on function public.get_entity_works_page(text, text, integer, integer) to anon, authenticated;
revoke execute on function public.get_entity_index_summaries() from public;
grant execute on function public.get_entity_index_summaries() to anon, authenticated;

drop index if exists public.works_actress_visible_trgm_idx;
drop index if exists public.works_genre_visible_trgm_idx;
