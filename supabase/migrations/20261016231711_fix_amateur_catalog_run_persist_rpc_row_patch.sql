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
      status = case when p_updates ? 'status' then patch.status else run.status end,
      total_count = case when p_updates ? 'total_count' then patch.total_count else run.total_count end,
      next_offset = case when p_updates ? 'next_offset' then patch.next_offset else run.next_offset end,
      fetched_item_count = case when p_updates ? 'fetched_item_count' then patch.fetched_item_count else run.fetched_item_count end,
      observed_item_key_paths = case when p_updates ? 'observed_item_key_paths' then patch.observed_item_key_paths else run.observed_item_key_paths end,
      last_error = case when p_updates ? 'last_error' then patch.last_error else run.last_error end,
      completed_at = case when p_updates ? 'completed_at' then patch.completed_at else run.completed_at end,
      current_range = case when p_updates ? 'current_range' then patch.current_range else run.current_range end,
      pending_ranges = case when p_updates ? 'pending_ranges' then patch.pending_ranges else run.pending_ranges end,
      expected_item_count = case when p_updates ? 'expected_item_count' then patch.expected_item_count else run.expected_item_count end,
      completed_range_count = case when p_updates ? 'completed_range_count' then patch.completed_range_count else run.completed_range_count end,
      range_count = case when p_updates ? 'range_count' then patch.range_count else run.range_count end,
      rank_next_offset = case when p_updates ? 'rank_next_offset' then patch.rank_next_offset else run.rank_next_offset end,
      rank_fetched_item_count = case when p_updates ? 'rank_fetched_item_count' then patch.rank_fetched_item_count else run.rank_fetched_item_count end,
      rank_total_count = case when p_updates ? 'rank_total_count' then patch.rank_total_count else run.rank_total_count end,
      rank_snapshot_at = case when p_updates ? 'rank_snapshot_at' then patch.rank_snapshot_at else run.rank_snapshot_at end,
      updated_at = now()
    from jsonb_populate_record(null::public.fanza_amateur_api_catalog_runs, p_updates) as patch
    where run.id = p_run_id
      and run.status = 'running'
      and run.updated_at = p_expected_updated_at
    returning run.*;
end;
$function$;
