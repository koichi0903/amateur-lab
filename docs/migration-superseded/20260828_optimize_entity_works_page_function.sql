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
security invoker
set search_path = ''
as $$
begin
  if p_kind = 'actress' then
    return query
      select w.id, w.title, w.image_url, w.score, w.review_average,
        w.review_count, w.price, w.sale_price, w.discount_rate,
        w.actress, w.genre, w.maker, w.series
      from public.works as w
      where w.actress ilike ('%' || p_name || '%')
        and p_name = any(regexp_split_to_array(coalesce(w.actress, ''), '\s*[/／,、]\s*'))
      order by w.score desc nulls last, w.id
      offset greatest(p_offset, 0)
      limit least(greatest(p_limit, 1), 300);
  elsif p_kind = 'genre' then
    return query
      select w.id, w.title, w.image_url, w.score, w.review_average,
        w.review_count, w.price, w.sale_price, w.discount_rate,
        w.actress, w.genre, w.maker, w.series
      from public.works as w
      where w.genre ilike ('%' || p_name || '%')
        and p_name = any(regexp_split_to_array(coalesce(w.genre, ''), '\s*[/／,、]\s*'))
      order by w.score desc nulls last, w.id
      offset greatest(p_offset, 0)
      limit least(greatest(p_limit, 1), 300);
  elsif p_kind = 'maker' then
    return query
      select w.id, w.title, w.image_url, w.score, w.review_average,
        w.review_count, w.price, w.sale_price, w.discount_rate,
        w.actress, w.genre, w.maker, w.series
      from public.works as w
      where w.maker = p_name
      order by w.score desc nulls last, w.id
      offset greatest(p_offset, 0)
      limit least(greatest(p_limit, 1), 300);
  elsif p_kind = 'series' then
    return query
      select w.id, w.title, w.image_url, w.score, w.review_average,
        w.review_count, w.price, w.sale_price, w.discount_rate,
        w.actress, w.genre, w.maker, w.series
      from public.works as w
      where w.series = p_name
      order by w.score desc nulls last, w.id
      offset greatest(p_offset, 0)
      limit least(greatest(p_limit, 1), 300);
  end if;
end;
$$;
