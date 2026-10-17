create or replace function public.get_fanza_amateur_entity_content_ids(p_kind text, p_name text)
returns text[]
language sql
stable
set search_path = public
as $$
  select coalesce(
    array_agg(content_id order by api_date desc nulls last, content_id asc),
    array[]::text[]
  )
  from public.fanza_amateur_entity_works
  where kind = p_kind
    and name = p_name;
$$;

revoke all on function public.get_fanza_amateur_entity_content_ids(text, text) from public, anon, authenticated, service_role;
grant execute on function public.get_fanza_amateur_entity_content_ids(text, text) to service_role;
