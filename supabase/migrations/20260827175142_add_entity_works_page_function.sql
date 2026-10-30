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
  from public.works as w
  where case p_kind
    when 'actress' then
      w.actress ilike ('%' || p_name || '%')
      and p_name = any(regexp_split_to_array(coalesce(w.actress, ''), '\s*[/／,、]\s*'))
    when 'genre' then
      w.genre ilike ('%' || p_name || '%')
      and p_name = any(regexp_split_to_array(coalesce(w.genre, ''), '\s*[/／,、]\s*'))
    when 'maker' then w.maker = p_name
    when 'series' then w.series = p_name
    else false
  end
  order by w.score desc nulls last, w.id
  offset greatest(p_offset, 0)
  limit least(greatest(p_limit, 1), 300);
$$;

revoke execute on function public.get_entity_works_page(text, text, integer, integer) from public;
grant execute on function public.get_entity_works_page(text, text, integer, integer) to anon, authenticated;
