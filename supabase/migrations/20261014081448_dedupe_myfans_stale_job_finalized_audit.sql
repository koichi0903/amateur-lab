create table if not exists public.myfans_audit_logs_stale_job_duplicate_archive (
  id bigint primary key,
  entity_type text not null,
  entity_id bigint not null,
  action text not null,
  summary text,
  metadata jsonb,
  created_at timestamptz not null,
  approved_media_id bigint,
  archived_at timestamptz not null default now(),
  archive_reason text not null
);

alter table public.myfans_audit_logs_stale_job_duplicate_archive enable row level security;
revoke all on table public.myfans_audit_logs_stale_job_duplicate_archive from anon, authenticated;

do $$
declare
  archived_rows integer;
  removed_rows integer;
begin
  insert into public.myfans_audit_logs_stale_job_duplicate_archive
    (id, entity_type, entity_id, action, summary, metadata, created_at, approved_media_id, archive_reason)
  select id, entity_type, entity_id, action, summary, metadata, created_at, approved_media_id,
         'Exact duplicate STALE_JOB_FINALIZED audit entry archived before enforcing unique key'
  from public.myfans_audit_logs
  where id in (787, 821, 822)
    and entity_type = 'quote_refresh_job'
    and entity_id in (52, 54)
    and action = 'STALE_JOB_FINALIZED'
  on conflict (id) do nothing;

  get diagnostics archived_rows = row_count;

  delete from public.myfans_audit_logs
  where id in (787, 821, 822)
    and entity_type = 'quote_refresh_job'
    and entity_id in (52, 54)
    and action = 'STALE_JOB_FINALIZED'
    and exists (
      select 1 from public.myfans_audit_logs_stale_job_duplicate_archive a
      where a.id = public.myfans_audit_logs.id
    );

  get diagnostics removed_rows = row_count;

  if removed_rows > archived_rows then
    raise exception 'Deduplication failed: removed % rows but archived only %', removed_rows, archived_rows;
  end if;

  if exists (
    select 1
    from public.myfans_audit_logs
    where action = 'STALE_JOB_FINALIZED'
      and entity_type = 'quote_refresh_job'
    group by entity_type, entity_id, action
    having count(*) > 1
  ) then
    raise exception 'Duplicate STALE_JOB_FINALIZED keys remain; unique index was not created';
  end if;
end;
$$;

create unique index if not exists myfans_audit_logs_stale_job_finalized_idx
  on public.myfans_audit_logs (entity_type, entity_id, action)
  where action = 'STALE_JOB_FINALIZED' and entity_type = 'quote_refresh_job';
