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
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  safe_offset integer := greatest(p_offset, 0);
  safe_limit integer := least(greatest(p_limit, 1), 300);
begin
  if p_kind = 'actress' then
    return query execute format($query$
      select w.id, w.title, w.image_url, w.score, w.review_average,
        w.review_count, w.price, w.sale_price, w.discount_rate,
        w.actress, w.genre, w.maker, w.series
      from public.works as w
      where coalesce(w.stage, '') <> 'DISCONTINUED'
        and w.actress ilike %L
        and %L = any(regexp_split_to_array(coalesce(w.actress, ''), '\s*[/／,、]\s*'))
      order by w.score desc nulls last, w.id
      offset %s limit %s
    $query$, '%' || p_name || '%', p_name, safe_offset, safe_limit);
  elsif p_kind = 'genre' then
    return query execute format($query$
      select w.id, w.title, w.image_url, w.score, w.review_average,
        w.review_count, w.price, w.sale_price, w.discount_rate,
        w.actress, w.genre, w.maker, w.series
      from public.works as w
      where coalesce(w.stage, '') <> 'DISCONTINUED'
        and w.genre ilike %L
        and %L = any(regexp_split_to_array(coalesce(w.genre, ''), '\s*[/／,、]\s*'))
      order by w.score desc nulls last, w.id
      offset %s limit %s
    $query$, '%' || p_name || '%', p_name, safe_offset, safe_limit);
  elsif p_kind = 'maker' then
    return query execute format($query$
      select w.id, w.title, w.image_url, w.score, w.review_average,
        w.review_count, w.price, w.sale_price, w.discount_rate,
        w.actress, w.genre, w.maker, w.series
      from public.works as w
      where coalesce(w.stage, '') <> 'DISCONTINUED'
        and w.maker = %L
      order by w.score desc nulls last, w.id
      offset %s limit %s
    $query$, p_name, safe_offset, safe_limit);
  elsif p_kind = 'series' then
    return query execute format($query$
      select w.id, w.title, w.image_url, w.score, w.review_average,
        w.review_count, w.price, w.sale_price, w.discount_rate,
        w.actress, w.genre, w.maker, w.series
      from public.works as w
      where coalesce(w.stage, '') <> 'DISCONTINUED'
        and w.series = %L
      order by w.score desc nulls last, w.id
      offset %s limit %s
    $query$, p_name, safe_offset, safe_limit);
  end if;
end;
$$;

revoke execute on function public.get_entity_works_page(text, text, integer, integer) from public;
grant execute on function public.get_entity_works_page(text, text, integer, integer) to anon, authenticated;
