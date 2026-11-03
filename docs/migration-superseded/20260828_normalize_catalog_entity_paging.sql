create table if not exists private.catalog_entity_works (
  kind text not null check (kind in ('actress', 'genre', 'maker', 'series')),
  name text not null,
  work_id bigint not null references public.works(id) on delete cascade,
  score bigint,
  primary key (kind, name, work_id)
);

create index if not exists catalog_entity_works_page_idx
  on private.catalog_entity_works (kind, name, score desc nulls last, work_id);

insert into private.catalog_entity_works (kind, name, work_id, score)
select distinct 'actress', btrim(value), w.id, w.score
from public.works as w
cross join lateral unnest(string_to_array(coalesce(w.actress, ''), ' / ')) as value
where coalesce(w.stage, '') <> 'DISCONTINUED'
  and btrim(value) <> ''

union all

select distinct 'genre', btrim(value), w.id, w.score
from public.works as w
cross join lateral unnest(string_to_array(coalesce(w.genre, ''), ' / ')) as value
where coalesce(w.stage, '') <> 'DISCONTINUED'
  and btrim(value) <> ''

union all

select 'maker', btrim(w.maker), w.id, w.score
from public.works as w
where coalesce(w.stage, '') <> 'DISCONTINUED'
  and btrim(coalesce(w.maker, '')) <> ''

union all

select 'series', btrim(w.series), w.id, w.score
from public.works as w
where coalesce(w.stage, '') <> 'DISCONTINUED'
  and btrim(coalesce(w.series, '')) <> ''
on conflict (kind, name, work_id) do update
set score = excluded.score;

create or replace function private.sync_catalog_entity_works()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from private.catalog_entity_works
  where work_id = coalesce(new.id, old.id);

  if tg_op <> 'DELETE' and coalesce(new.stage, '') <> 'DISCONTINUED' then
    insert into private.catalog_entity_works (kind, name, work_id, score)
    select distinct 'actress', btrim(value), new.id, new.score
    from unnest(string_to_array(coalesce(new.actress, ''), ' / ')) as value
    where btrim(value) <> ''

    union all

    select distinct 'genre', btrim(value), new.id, new.score
    from unnest(string_to_array(coalesce(new.genre, ''), ' / ')) as value
    where btrim(value) <> ''

    union all

    select 'maker', btrim(new.maker), new.id, new.score
    where btrim(coalesce(new.maker, '')) <> ''

    union all

    select 'series', btrim(new.series), new.id, new.score
    where btrim(coalesce(new.series, '')) <> ''
    on conflict (kind, name, work_id) do update
    set score = excluded.score;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.sync_catalog_entity_works() from public;

drop trigger if exists sync_catalog_entity_works_insert on public.works;
create trigger sync_catalog_entity_works_insert
after insert on public.works
for each row execute function private.sync_catalog_entity_works();

drop trigger if exists sync_catalog_entity_works_update on public.works;
create trigger sync_catalog_entity_works_update
after update of actress, genre, maker, series, score, stage on public.works
for each row execute function private.sync_catalog_entity_works();

drop trigger if exists sync_catalog_entity_works_delete on public.works;
create trigger sync_catalog_entity_works_delete
after delete on public.works
for each row execute function private.sync_catalog_entity_works();

grant usage on schema private to anon, authenticated;
grant select on private.catalog_entity_works to anon, authenticated;
grant select on private.entity_index_summary_cache to anon, authenticated;

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
