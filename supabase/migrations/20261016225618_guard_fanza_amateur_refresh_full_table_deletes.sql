do $repair$
declare
  target record;
  source text;
  patched text;
  expected text;
begin
  for target in
    select * from (values
      ('refresh_fanza_amateur_taxonomy', 'delete from public.fanza_amateur_taxonomy;'),
      ('refresh_fanza_amateur_entity_works', 'delete from public.fanza_amateur_entity_works;'),
      ('refresh_fanza_amateur_campaigns', 'delete from public.fanza_amateur_campaigns;')
    ) as x(function_name, expected_delete)
  loop
    select pg_get_functiondef(p.oid)
      into source
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = target.function_name;

    if source is null then
      raise exception 'Expected function public.% was not found', target.function_name;
    end if;

    expected := target.expected_delete;
    if position(expected in source) = 0 then
      raise exception 'Expected exact DELETE statement missing from public.%', target.function_name;
    end if;
    if position(expected || ' where true;' in source) > 0 then
      raise exception 'public.% appears already patched; refusing ambiguous edit', target.function_name;
    end if;

    patched := replace(source, expected, replace(expected, ';', ' where true;'));
    execute patched;
  end loop;
end
$repair$;

do $verify$
declare
  function_name text;
  definition text;
begin
  foreach function_name in array array[
    'refresh_fanza_amateur_taxonomy',
    'refresh_fanza_amateur_entity_works',
    'refresh_fanza_amateur_campaigns'
  ]
  loop
    select pg_get_functiondef(p.oid)
      into definition
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = function_name;
    if definition is null or position('where true' in lower(definition)) = 0 then
      raise exception 'Verification failed for public.%', function_name;
    end if;
  end loop;
end
$verify$;
