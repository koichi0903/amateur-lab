create table public.fanza_amateur_price_weekly_snapshots (
  source_run_id uuid not null references public.fanza_amateur_api_catalog_runs(id) on delete cascade,
  content_id text not null,
  observed_at timestamptz not null,
  prices jsonb not null default '{}'::jsonb check (jsonb_typeof(prices) = 'object'),
  primary key (source_run_id, content_id)
);

create index fanza_amateur_price_weekly_snapshots_work_observed_idx
  on public.fanza_amateur_price_weekly_snapshots (content_id, observed_at desc);

create index fanza_amateur_price_weekly_snapshots_observed_idx
  on public.fanza_amateur_price_weekly_snapshots (observed_at);

alter table public.fanza_amateur_price_weekly_snapshots enable row level security;
revoke all privileges on table public.fanza_amateur_price_weekly_snapshots from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.fanza_amateur_price_weekly_snapshots to service_role;
grant delete on table public.fanza_amateur_price_history to service_role;

create or replace function public.prune_fanza_amateur_price_history()
returns table (deleted_change_rows bigint, deleted_weekly_rows bigint)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  retention_cutoff timestamptz := now() - interval '1 year';
begin
  delete from public.fanza_amateur_price_history
  where observed_at < retention_cutoff;
  get diagnostics deleted_change_rows = row_count;

  delete from public.fanza_amateur_price_weekly_snapshots
  where observed_at < retention_cutoff;
  get diagnostics deleted_weekly_rows = row_count;

  return next;
end;
$$;

revoke all on function public.prune_fanza_amateur_price_history() from public, anon, authenticated;
grant execute on function public.prune_fanza_amateur_price_history() to service_role;
