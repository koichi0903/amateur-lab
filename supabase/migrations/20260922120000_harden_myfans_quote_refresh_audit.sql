alter table public.myfans_audit_logs
  drop constraint if exists myfans_audit_logs_entity_type_check;

alter table public.myfans_audit_logs
  add constraint myfans_audit_logs_entity_type_check
  check (entity_type in ('creator', 'product', 'x_post', 'conversion', 'click', 'media', 'import', 'quote_refresh_job'));

create unique index if not exists myfans_audit_logs_stale_job_finalized_idx
  on public.myfans_audit_logs (entity_type, entity_id, action)
  where action = 'STALE_JOB_FINALIZED' and entity_type = 'quote_refresh_job';
