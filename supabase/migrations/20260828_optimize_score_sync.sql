create index if not exists catalog_entity_works_work_id_idx
  on private.catalog_entity_works (work_id);

drop trigger if exists sync_catalog_entity_works_update on public.works;
create trigger sync_catalog_entity_works_update
after update of actress, genre, maker, series, stage on public.works
for each row execute function private.sync_catalog_entity_works();

grant usage on schema private to service_role;
grant select, update on private.catalog_entity_works to service_role;

create or replace function public.sync_catalog_entity_scores(p_work_ids bigint[])
returns integer
language sql
volatile
security invoker
set search_path = ''
as $$
  with updated as (
    update private.catalog_entity_works as entity
    set score = works.score
    from public.works as works
    where works.id = entity.work_id
      and works.id = any(coalesce(p_work_ids, '{}'::bigint[]))
      and entity.score is distinct from works.score
    returning 1
  )
  select count(*)::integer from updated;
$$;

revoke execute on function public.sync_catalog_entity_scores(bigint[])
  from public, anon, authenticated;
grant execute on function public.sync_catalog_entity_scores(bigint[])
  to service_role;
