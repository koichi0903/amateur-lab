create or replace function public.persist_fanza_amateur_api_catalog_run(
  p_run_id uuid,
  p_expected_updated_at timestamptz,
  p_updates jsonb
)
returns setof public.fanza_amateur_api_catalog_runs
language plpgsql
set search_path to 'public'
set statement_timeout to '2min'
as $function$
begin
  if p_updates is null or jsonb_typeof(p_updates) <> 'object' then
    raise exception 'p_updates must be a JSON object';
  end if;

  if (p_updates - array[
    'status',
    'total_count',
    'next_offset',
    'fetched_item_count',
    'observed_item_key_paths',
    'last_error',
    'completed_at',
    'current_range',
    'pending_ranges',
    'expected_item_count',
    'completed_range_count',
    'range_count',
    'rank_next_offset',
    'rank_fetched_item_count',
    'rank_total_count',
    'rank_snapshot_at'
  ]) <> '{}'::jsonb then
    raise exception 'p_updates contains a non-editable field';
  end if;

  return query
    update public.fanza_amateur_api_catalog_runs as run
    set
      status = patch.status,
      total_count = patch.total_count,
      next_offset = patch.next_offset,
      fetched_item_count = patch.fetched_item_count,
      observed_item_key_paths = patch.observed_item_key_paths,
      last_error = patch.last_error,
      completed_at = patch.completed_at,
      current_range = patch.current_range,
      pending_ranges = patch.pending_ranges,
      expected_item_count = patch.expected_item_count,
      completed_range_count = patch.completed_range_count,
      range_count = patch.range_count,
      rank_next_offset = patch.rank_next_offset,
      rank_fetched_item_count = patch.rank_fetched_item_count,
      rank_total_count = patch.rank_total_count,
      rank_snapshot_at = patch.rank_snapshot_at,
      updated_at = now()
    from jsonb_populate_record(run, p_updates) as patch
    where run.id = p_run_id
      and run.status = 'running'
      and run.updated_at = p_expected_updated_at
    returning run.*;
end;
$function$;

revoke all on function public.persist_fanza_amateur_api_catalog_run(uuid, timestamptz, jsonb)
from public, anon, authenticated;
grant execute on function public.persist_fanza_amateur_api_catalog_run(uuid, timestamptz, jsonb)
to service_role;
