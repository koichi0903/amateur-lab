create or replace function public.refresh_fanza_amateur_taxonomy_after_catalog_run()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if old.status is distinct from new.status and new.status = 'completed' then
    perform public.refresh_fanza_amateur_taxonomy();
    perform public.refresh_fanza_amateur_entity_works();
    perform public.refresh_fanza_amateur_campaigns();
  end if;
  return new;
end;
$function$;
