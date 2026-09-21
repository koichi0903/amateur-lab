alter table public.myfans_quote_refresh_jobs
  add column if not exists collection_session_id text,
  add column if not exists launch_mode text not null default 'legacy',
  add column if not exists collector_version text;

alter table public.myfans_quote_refresh_jobs
  drop constraint if exists myfans_quote_refresh_jobs_launch_mode_chk;

alter table public.myfans_quote_refresh_jobs
  add constraint myfans_quote_refresh_jobs_launch_mode_chk
  check (launch_mode in ('new', 'resumed', 'legacy'));

create index if not exists myfans_quote_refresh_jobs_session_idx
  on public.myfans_quote_refresh_jobs (collection_session_id, status, created_at desc);
