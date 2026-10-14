create table if not exists public.x_growth_video_candidate_selections (
  account_handle text primary key check (account_handle = 'hakkutsu_lab'),
  selected_work_ids bigint[] not null default '{}'::bigint[],
  manual_override_work_ids bigint[] not null default '{}'::bigint[],
  excluded_work_ids bigint[] not null default '{}'::bigint[],
  candidate_snapshot jsonb not null default '{}'::jsonb,
  revision integer not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now(),
  check (cardinality(selected_work_ids) <= 5),
  check (cardinality(manual_override_work_ids) <= 5),
  check (cardinality(excluded_work_ids) <= 5)
);

alter table public.x_growth_video_candidate_selections enable row level security;
revoke all on table public.x_growth_video_candidate_selections from anon, authenticated;
grant select, insert, update on table public.x_growth_video_candidate_selections to service_role;

create or replace function public.save_x_growth_video_candidate_selection(
  p_expected_revision integer,
  p_selected_work_ids bigint[],
  p_manual_override_work_ids bigint[],
  p_excluded_work_ids bigint[],
  p_candidate_snapshot jsonb
)
returns setof public.x_growth_video_candidate_selections
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_expected_revision is null or p_expected_revision < 0
     or coalesce(cardinality(p_selected_work_ids), 0) > 5
     or coalesce(cardinality(p_manual_override_work_ids), 0) > 5
     or coalesce(cardinality(p_excluded_work_ids), 0) > 5
     or coalesce(jsonb_typeof(p_candidate_snapshot), '') <> 'object'
     or coalesce(cardinality(p_selected_work_ids), 0) <> (select count(distinct value) from unnest(coalesce(p_selected_work_ids, '{}'::bigint[])) as expanded(value))
     or coalesce(cardinality(p_manual_override_work_ids), 0) <> (select count(distinct value) from unnest(coalesce(p_manual_override_work_ids, '{}'::bigint[])) as expanded(value))
     or coalesce(cardinality(p_excluded_work_ids), 0) <> (select count(distinct value) from unnest(coalesce(p_excluded_work_ids, '{}'::bigint[])) as expanded(value)) then
    raise exception 'invalid candidate selection payload' using errcode = '22023';
  end if;

  return query
  insert into public.x_growth_video_candidate_selections as current_selection (
    account_handle,
    selected_work_ids,
    manual_override_work_ids,
    excluded_work_ids,
    candidate_snapshot,
    revision,
    updated_at
  ) values (
    'hakkutsu_lab',
    coalesce(p_selected_work_ids, '{}'::bigint[]),
    coalesce(p_manual_override_work_ids, '{}'::bigint[]),
    coalesce(p_excluded_work_ids, '{}'::bigint[]),
    p_candidate_snapshot,
    1,
    now()
  )
  on conflict (account_handle) do update set
    selected_work_ids = excluded.selected_work_ids,
    manual_override_work_ids = excluded.manual_override_work_ids,
    excluded_work_ids = excluded.excluded_work_ids,
    candidate_snapshot = excluded.candidate_snapshot,
    revision = current_selection.revision + 1,
    updated_at = now()
  where current_selection.revision = p_expected_revision
  returning current_selection.*;

  if not found then
    raise exception 'candidate selection revision conflict' using errcode = '40001';
  end if;
end;
$$;

revoke all on function public.save_x_growth_video_candidate_selection(integer, bigint[], bigint[], bigint[], jsonb) from public, anon, authenticated;
grant execute on function public.save_x_growth_video_candidate_selection(integer, bigint[], bigint[], bigint[], jsonb) to service_role;
