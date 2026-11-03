alter table public.myfans_quote_refresh_jobs
  add column if not exists collection_run_token text;

create index if not exists myfans_quote_refresh_jobs_run_identity_idx
  on public.myfans_quote_refresh_jobs (id, collection_session_id, collection_run_token, collector_version);
