alter table public.fanza_amateur_x_post_jobs
  drop constraint if exists fanza_amateur_x_post_jobs_account_handle_content_id_key;

create unique index if not exists fanza_amateur_x_post_jobs_pending_content_uidx
  on public.fanza_amateur_x_post_jobs (account_handle, content_id)
  where status = 'pending';
