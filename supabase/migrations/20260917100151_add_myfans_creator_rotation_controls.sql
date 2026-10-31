alter table public.myfans_quote_refresh_jobs
  add column if not exists rotation_cooldown_days integer not null default 3,
  add column if not exists minimum_rotation_cooldown_days integer not null default 1,
  add column if not exists eligible_creators integer not null default 0,
  add column if not exists cooldown_excluded_creators integer not null default 0,
  add column if not exists selection_mode text not null default 'strict',
  add column if not exists selection_note text,
  add column if not exists sensitive_gate_streak_limit integer not null default 3,
  add column if not exists sensitive_gate_streak integer not null default 0,
  add column if not exists stopped_reason text;

alter table public.myfans_quote_refresh_jobs
  add constraint myfans_quote_refresh_jobs_rotation_cooldown_chk
    check (rotation_cooldown_days between 1 and 30),
  add constraint myfans_quote_refresh_jobs_min_rotation_cooldown_chk
    check (minimum_rotation_cooldown_days between 1 and rotation_cooldown_days),
  add constraint myfans_quote_refresh_jobs_selection_mode_chk
    check (selection_mode in ('strict', 'relaxed', 'empty')),
  add constraint myfans_quote_refresh_jobs_gate_limit_chk
    check (sensitive_gate_streak_limit between 1 and 10),
  add constraint myfans_quote_refresh_jobs_gate_streak_chk
    check (sensitive_gate_streak >= 0);

create index if not exists myfans_quote_refresh_job_items_creator_processed_idx
  on public.myfans_quote_refresh_job_items (creator_id, processed_at desc)
  where processed_at is not null;

alter table public.myfans_quote_refresh_jobs enable row level security;
alter table public.myfans_quote_refresh_job_items enable row level security;
revoke all on table public.myfans_quote_refresh_jobs from anon, authenticated;
revoke all on table public.myfans_quote_refresh_job_items from anon, authenticated;
