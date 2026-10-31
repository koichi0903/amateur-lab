create or replace function public.get_entity_index_summaries_by_kind(
  p_kind text
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when p_kind in ('actress', 'maker', 'series', 'genre') then coalesce(
      private.read_entity_index_summaries() -> p_kind,
      '[]'::jsonb
    )
    else '[]'::jsonb
  end;
$$;

revoke execute on function public.get_entity_index_summaries_by_kind(text)
  from public;
grant execute on function public.get_entity_index_summaries_by_kind(text)
  to anon, authenticated, service_role;
