create table public.fanza_amateur_taxonomy (
  kind text not null check (kind in ('genre', 'maker')),
  name text not null,
  work_count integer not null check (work_count > 0),
  image_url text,
  representative_content_id text,
  refreshed_at timestamptz not null default now(),
  primary key (kind, name)
);

create index fanza_amateur_taxonomy_list_idx
  on public.fanza_amateur_taxonomy (kind, work_count desc, name);

alter table public.fanza_amateur_taxonomy enable row level security;
revoke all privileges on table public.fanza_amateur_taxonomy from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.fanza_amateur_taxonomy to service_role;

create or replace function public.refresh_fanza_amateur_taxonomy()
returns void
language plpgsql
set search_path = public
as $$
begin
  delete from public.fanza_amateur_taxonomy;

  insert into public.fanza_amateur_taxonomy (
    kind, name, work_count, image_url, representative_content_id, refreshed_at
  )
  with expanded as (
    select
      category.kind,
      nullif(btrim(category.value ->> 'name'), '') as name,
      work.content_id,
      work.api_date,
      nullif(coalesce(work.image_url ->> 'large', work.image_url ->> 'small', work.image_url ->> 'list'), '') as image_url
    from public.fanza_amateur_works as work
    cross join lateral (
      select 'genre'::text as kind, value
      from jsonb_array_elements(
        case when jsonb_typeof(work.iteminfo -> 'genre') = 'array'
          then work.iteminfo -> 'genre' else '[]'::jsonb end
      ) as value
      union all
      select 'maker'::text as kind, value
      from jsonb_array_elements(
        case when jsonb_typeof(work.iteminfo -> 'maker') = 'array'
          then work.iteminfo -> 'maker' else '[]'::jsonb end
      ) as value
    ) as category
    where nullif(btrim(category.value ->> 'name'), '') is not null
  ),
  counts as (
    select kind, name, count(distinct content_id)::integer as work_count
    from expanded
    group by kind, name
  ),
  candidates as (
    select distinct
      expanded.kind, expanded.name, expanded.content_id, expanded.api_date, expanded.image_url,
      counts.work_count
    from expanded
    join counts using (kind, name)
    where expanded.image_url is not null
  ),
  image_owners as (
    select candidates.*,
      row_number() over (
        partition by kind, image_url
        order by work_count desc, api_date desc nulls last, name, content_id
      ) as image_owner_rank
    from candidates
  ),
  representatives as (
    select image_owners.*,
      row_number() over (
        partition by kind, name
        order by api_date desc nulls last, content_id
      ) as representative_rank
    from image_owners
    where image_owner_rank = 1
  )
  select
    counts.kind,
    counts.name,
    counts.work_count,
    representatives.image_url,
    representatives.content_id,
    now()
  from counts
  left join representatives
    on representatives.kind = counts.kind
    and representatives.name = counts.name
    and representatives.representative_rank = 1;
end;
$$;

revoke all on function public.refresh_fanza_amateur_taxonomy() from public, anon, authenticated, service_role;
grant execute on function public.refresh_fanza_amateur_taxonomy() to service_role;

create or replace function public.refresh_fanza_amateur_taxonomy_after_catalog_run()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform public.refresh_fanza_amateur_taxonomy();
  return new;
end;
$$;

revoke all on function public.refresh_fanza_amateur_taxonomy_after_catalog_run() from public, anon, authenticated, service_role;
grant execute on function public.refresh_fanza_amateur_taxonomy_after_catalog_run() to service_role;

create trigger fanza_amateur_taxonomy_on_catalog_run_completion
after update of status on public.fanza_amateur_api_catalog_runs
for each row
when (old.status = 'running' and new.status in ('completed', 'limit_reached'))
execute function public.refresh_fanza_amateur_taxonomy_after_catalog_run();

select public.refresh_fanza_amateur_taxonomy();
