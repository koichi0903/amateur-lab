-- @bijyo1010 is operated manually. Keep the legacy auto-post tables for history,
-- but make the state machine represent manual posting and trim preparation.
alter table public.bijyo_reserved_post_jobs drop constraint if exists bijyo_reserved_post_jobs_status_check;

alter table public.bijyo_reserved_post_jobs
  add column if not exists trim_status text not null default 'not_ready',
  add column if not exists trim_failure_reason text,
  add column if not exists skip_reason text;

update public.bijyo_reserved_post_jobs
set status = case
  when status in ('posting', 'reply_pending') then 'pending'
  when status in ('reply_failed', 'failed') then 'trim_failed'
  else status
end;

alter table public.bijyo_reserved_post_jobs
  add constraint bijyo_reserved_post_jobs_status_check
  check (status in ('pending', 'posted', 'manual_posted', 'skipped', 'excluded', 'trim_failed'));

update public.bijyo_reserved_settings
set enabled = false
where account_handle = 'bijyo1010';
