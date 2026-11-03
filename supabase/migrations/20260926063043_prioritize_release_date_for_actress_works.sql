create or replace function public.get_actress_works_page(
  p_name text,
  p_offset integer default 0,
  p_limit integer default 60
)
returns table (
  id bigint,
  product_id text,
  title text,
  image_url text,
  score bigint,
  review_average numeric,
  review_count integer,
  price integer,
  sale_price integer,
  list_price integer,
  discount_rate integer,
  lowest_price integer,
  is_bottom_price boolean,
  sale_end_at timestamptz,
  release_date date,
  product_release_date date,
  affiliate_url text,
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
    w.product_id,
    w.title,
    w.image_url,
    w.score,
    w.review_average,
    w.review_count,
    w.price,
    w.sale_price,
    w.list_price,
    w.discount_rate,
    w.lowest_price,
    w.is_bottom_price,
    w.sale_end_at,
    w.release_date,
    w.product_release_date,
    w.affiliate_url,
    w.actress,
    w.genre,
    w.maker,
    w.series
  from private.catalog_entity_works as entity
  join public.works as w on w.id = entity.work_id
  where entity.kind = 'actress'
    and entity.name = p_name
  order by coalesce(w.release_date, w.product_release_date) desc nulls last, w.id desc
  offset greatest(p_offset, 0)
  limit least(greatest(p_limit, 1), 300);
$$;

revoke execute on function public.get_actress_works_page(text, integer, integer) from public;
grant execute on function public.get_actress_works_page(text, integer, integer) to anon, authenticated;
