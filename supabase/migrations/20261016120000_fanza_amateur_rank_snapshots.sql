alter table public.fanza_amateur_api_catalog_runs
  add column rank_next_offset integer not null default 0
    check (rank_next_offset between 0 and 5001),
  add column rank_fetched_item_count integer not null default 0
    check (rank_fetched_item_count between 0 and 5000),
  add column rank_total_count integer
    check (rank_total_count is null or rank_total_count >= 0),
  add column rank_snapshot_at timestamptz;

alter table public.fanza_amateur_works
  add column rank_observed_at timestamptz;

create table public.fanza_amateur_rank_snapshot_items (
  run_id uuid not null references public.fanza_amateur_api_catalog_runs(id) on delete cascade,
  rank integer not null check (rank between 1 and 5000),
  content_id text not null,
  captured_at timestamptz not null,
  primary key (run_id, rank)
);

create index fanza_amateur_rank_snapshot_items_content_idx
  on public.fanza_amateur_rank_snapshot_items (content_id, captured_at desc);

alter table public.fanza_amateur_rank_snapshot_items enable row level security;
revoke all privileges on table public.fanza_amateur_rank_snapshot_items from public, anon, authenticated, service_role;
grant select, insert, update on table public.fanza_amateur_rank_snapshot_items to service_role;

create or replace function public.save_fanza_amateur_rank_snapshot_page(
  p_run_id uuid,
  p_captured_at timestamptz,
  p_items jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_count integer;
begin
  if coalesce(jsonb_typeof(p_items), '') <> 'array' or jsonb_array_length(p_items) > 100 then
    raise exception 'Invalid rank snapshot page';
  end if;

  insert into public.fanza_amateur_rank_snapshot_items (run_id, rank, content_id, captured_at)
  select p_run_id, item.rank, item.content_id, p_captured_at
  from jsonb_to_recordset(p_items) as item(rank integer, content_id text)
  on conflict (run_id, rank) do update
    set content_id = excluded.content_id,
        captured_at = excluded.captured_at;
  get diagnostics saved_count = row_count;

  update public.fanza_amateur_works as works
  set rank = item.rank,
      rank_observed_at = p_captured_at
  from jsonb_to_recordset(p_items) as item(rank integer, content_id text)
  where works.content_id = item.content_id;

  return saved_count;
end;
$$;

revoke all on function public.save_fanza_amateur_rank_snapshot_page(uuid, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.save_fanza_amateur_rank_snapshot_page(uuid, timestamptz, jsonb) to service_role;
