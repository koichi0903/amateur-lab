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
    return query execute $query$
      select w.id, w.title, w.image_url, w.score, w.review_average,
        w.review_count, w.price, w.sale_price, w.discount_rate,
        w.actress, w.genre, w.maker, w.series
      from public.works as w
      where w.actress ilike ('%' || $1 || '%')
        and $1 = any(regexp_split_to_array(coalesce(w.actress, ''), '\s*[/／,、]\s*'))
      order by w.score desc nulls last, w.id
      offset greatest($2, 0)
      limit least(greatest($3, 1), 300)
    $query$ using p_name, p_offset, p_limit;
  elsif p_kind = 'genre' then
    return query execute $query$
      select w.id, w.title, w.image_url, w.score, w.review_average,
        w.review_count, w.price, w.sale_price, w.discount_rate,
        w.actress, w.genre, w.maker, w.series
      from public.works as w
      where w.genre ilike ('%' || $1 || '%')
        and $1 = any(regexp_split_to_array(coalesce(w.genre, ''), '\s*[/／,、]\s*'))
      order by w.score desc nulls last, w.id
      offset greatest($2, 0)
      limit least(greatest($3, 1), 300)
    $query$ using p_name, p_offset, p_limit;
  elsif p_kind = 'maker' then
    return query execute $query$
      select w.id, w.title, w.image_url, w.score, w.review_average,
        w.review_count, w.price, w.sale_price, w.discount_rate,
        w.actress, w.genre, w.maker, w.series
      from public.works as w
      where w.maker = $1
      order by w.score desc nulls last, w.id
      offset greatest($2, 0)
      limit least(greatest($3, 1), 300)
    $query$ using p_name, p_offset, p_limit;
  elsif p_kind = 'series' then
    return query execute $query$
      select w.id, w.title, w.image_url, w.score, w.review_average,
        w.review_count, w.price, w.sale_price, w.discount_rate,
        w.actress, w.genre, w.maker, w.series
      from public.works as w
      where w.series = $1
      order by w.score desc nulls last, w.id
      offset greatest($2, 0)
      limit least(greatest($3, 1), 300)
    $query$ using p_name, p_offset, p_limit;
  end if;
end;
$$;
