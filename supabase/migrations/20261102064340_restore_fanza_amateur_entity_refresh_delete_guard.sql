-- Roll forward after 20261101135306_optimize_fanza_amateur_related_work_lookup.
-- Restore the explicit full-refresh predicate required by safeupdate, as in
-- 20261016225618. Keep the optimized series/genre/maker body and all attributes.
-- Apply only with separate DB approval and no concurrent function replacement.
-- A different body or an already-guarded body must be reconciled before applying.
-- This changes the definition only: it does not refresh data or retry failed runs.
-- WHERE true still deletes all derived entity rows when a refresh is later called.
do $repair$
declare
  target_oid oid := pg_catalog.to_regprocedure('public.refresh_fanza_amateur_entity_works()');
  original_owner oid;
  original_acl aclitem[];
  current_body text;
  normalized_expected_body text;
  definition text;
  patched_definition text;
  expected_delete constant text := 'delete from public.fanza_amateur_entity_works;';
  guarded_delete constant text := 'delete from public.fanza_amateur_entity_works where true;';
  expected_body constant text := $expected$
  delete from public.fanza_amateur_entity_works;
  insert into public.fanza_amateur_entity_works (kind, name, content_id, api_date)
  select distinct
    entity.kind,
    nullif(btrim(entity.value ->> 'name'), ''),
    work.content_id,
    work.api_date
  from public.fanza_amateur_works as work
  cross join lateral (
    select 'series'::text as kind, value
    from jsonb_array_elements(
      case when jsonb_typeof(work.iteminfo -> 'series') = 'array'
        then work.iteminfo -> 'series' else '[]'::jsonb end
    ) as value
    union all
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
  ) as entity
  where nullif(btrim(entity.value ->> 'name'), '') is not null;
$expected$;
begin
  if target_oid is null then
    raise exception 'Expected function public.refresh_fanza_amateur_entity_works() was not found';
  end if;

  select p.proowner, p.proacl, p.prosrc, pg_catalog.pg_get_functiondef(p.oid)
    into original_owner, original_acl, current_body, definition
    from pg_catalog.pg_proc as p
    join pg_catalog.pg_language as l on l.oid = p.prolang
    where p.oid = target_oid
      and p.prokind = 'f'
      and l.lanname = 'sql'
      and p.prorettype = 'pg_catalog.void'::pg_catalog.regtype
      and not p.proretset;

  if definition is null then
    raise exception 'Expected a non-set-returning SQL void function public.refresh_fanza_amateur_entity_works()';
  end if;

  -- Only normalize line endings and outer whitespace; reject all other drift.
  current_body := btrim(replace(current_body, E'\r\n', E'\n'), E' \t\r\n');
  normalized_expected_body := btrim(replace(expected_body, E'\r\n', E'\n'), E' \t\r\n');
  if current_body = replace(normalized_expected_body, expected_delete, guarded_delete) then
    raise exception 'public.refresh_fanza_amateur_entity_works() is already guarded; reconcile migration history before applying';
  end if;
  if current_body is distinct from normalized_expected_body then
    raise exception 'Unexpected body for public.refresh_fanza_amateur_entity_works(); expected the 20261101135306 definition';
  end if;

  if length(definition) - length(replace(definition, expected_delete, ''))
      <> length(expected_delete) then
    raise exception 'Expected exactly one unguarded entity-works DELETE in public.refresh_fanza_amateur_entity_works()';
  end if;

  -- Reuse the live CREATE OR REPLACE definition so all function attributes remain.
  -- CREATE OR REPLACE also retains ownership, ACLs and dependent objects.
  patched_definition := replace(definition, expected_delete, guarded_delete);
  execute patched_definition;

  if pg_catalog.pg_get_functiondef(target_oid) is distinct from patched_definition then
    raise exception 'Definition verification failed for public.refresh_fanza_amateur_entity_works()';
  end if;
  if exists (
    select 1
    from pg_catalog.pg_proc as p
    where p.oid = target_oid
      and (p.proowner is distinct from original_owner or p.proacl is distinct from original_acl)
  ) then
    raise exception 'Ownership/ACL verification failed for public.refresh_fanza_amateur_entity_works()';
  end if;
end
$repair$;

