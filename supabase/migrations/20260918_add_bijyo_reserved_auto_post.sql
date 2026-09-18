create table if not exists public.bijyo_reserved_settings (
  account_handle text primary key check (account_handle = 'bijyo1010'),
  enabled boolean not null default false,
  schedule_times text[] not null default array['09:00','13:00','18:00','22:00'],
  timezone text not null default 'Asia/Tokyo',
  updated_at timestamptz not null default now()
);

insert into public.bijyo_reserved_settings (account_handle)
values ('bijyo1010')
on conflict (account_handle) do nothing;

create table if not exists public.bijyo_reserved_post_jobs (
  id bigserial primary key,
  account_handle text not null default 'bijyo1010' check (account_handle = 'bijyo1010'),
  work_id bigint not null references public.works(id) on delete restrict,
  kind text not null check (kind in ('auto','manual')),
  slot_date date not null,
  slot_index smallint check (slot_index between 0 and 3),
  scheduled_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','posted','manual_posted','skipped','excluded','trim_failed')),
  idempotency_key text not null unique,
  attempts integer not null default 0 check (attempts >= 0),
  main_text text not null,
  reply_text text not null,
  trim_start_seconds numeric(6,1) not null default 0 check (trim_start_seconds >= 0),
  trim_status text not null default 'not_ready' check (trim_status in ('not_ready','preparing','ready','trim_failed')),
  trim_failure_reason text,
  x_post_id text,
  reply_post_id text,
  posted_at timestamptz,
  failure_reason text,
  skip_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_handle, work_id)
);

create index if not exists bijyo_reserved_jobs_schedule_idx
  on public.bijyo_reserved_post_jobs (account_handle, slot_date, slot_index, scheduled_at);
create index if not exists bijyo_reserved_jobs_status_idx
  on public.bijyo_reserved_post_jobs (account_handle, status, scheduled_at);

alter table public.bijyo_reserved_post_jobs drop constraint if exists bijyo_reserved_post_jobs_status_check;
alter table public.bijyo_reserved_post_jobs add constraint bijyo_reserved_post_jobs_status_check check (status in ('pending','posted','manual_posted','skipped','excluded','trim_failed'));
alter table public.bijyo_reserved_post_jobs add column if not exists trim_status text not null default 'not_ready';
alter table public.bijyo_reserved_post_jobs add column if not exists trim_failure_reason text;
alter table public.bijyo_reserved_post_jobs add column if not exists skip_reason text;

create table if not exists public.bijyo_reserved_post_logs (
  id bigserial primary key,
  account_handle text not null default 'bijyo1010' check (account_handle = 'bijyo1010'),
  job_id bigint not null references public.bijyo_reserved_post_jobs(id) on delete cascade,
  event_type text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists bijyo_reserved_post_logs_job_idx
  on public.bijyo_reserved_post_logs (account_handle, job_id, created_at desc);

alter table public.bijyo_reserved_settings enable row level security;
alter table public.bijyo_reserved_post_jobs enable row level security;
alter table public.bijyo_reserved_post_logs enable row level security;
revoke all on table public.bijyo_reserved_settings from anon, authenticated;
revoke all on table public.bijyo_reserved_post_jobs from anon, authenticated;
revoke all on table public.bijyo_reserved_post_logs from anon, authenticated;
revoke all on sequence public.bijyo_reserved_post_jobs_id_seq from anon, authenticated;
revoke all on sequence public.bijyo_reserved_post_logs_id_seq from anon, authenticated;

create or replace function public.set_bijyo_reserved_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists bijyo_reserved_settings_updated_at on public.bijyo_reserved_settings;
create trigger bijyo_reserved_settings_updated_at before update on public.bijyo_reserved_settings
for each row execute function public.set_bijyo_reserved_updated_at();
drop trigger if exists bijyo_reserved_jobs_updated_at on public.bijyo_reserved_post_jobs;
create trigger bijyo_reserved_jobs_updated_at before update on public.bijyo_reserved_post_jobs
for each row execute function public.set_bijyo_reserved_updated_at();
