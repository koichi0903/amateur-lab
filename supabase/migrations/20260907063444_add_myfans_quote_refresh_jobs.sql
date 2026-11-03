create table if not exists public.myfans_quote_refresh_jobs (
  id bigserial primary key,
  approved_media_id bigint references public.myfans_approved_media(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled')),
  total_creators integer not null default 0 check (total_creators >= 0),
  processed_creators integer not null default 0 check (processed_creators >= 0),
  success_creators integer not null default 0 check (success_creators >= 0),
  failed_creators integer not null default 0 check (failed_creators >= 0),
  batch_size integer not null default 25 check (batch_size between 1 and 50),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  last_error text
);

create table if not exists public.myfans_quote_refresh_job_items (
  id bigserial primary key,
  job_id bigint not null references public.myfans_quote_refresh_jobs(id) on delete cascade,
  creator_id bigint not null references public.myfans_creators(id) on delete cascade,
  creator_x_url text not null,
  status text not null default 'pending' check (status in ('pending', 'running', 'success', 'failed', 'skipped')),
  attempts integer not null default 0 check (attempts >= 0),
  collected_count integer not null default 0 check (collected_count >= 0),
  top_score integer,
  error text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (job_id, creator_id)
);

create index if not exists myfans_quote_refresh_jobs_status_idx
  on public.myfans_quote_refresh_jobs (status, created_at desc);

create index if not exists myfans_quote_refresh_job_items_next_idx
  on public.myfans_quote_refresh_job_items (job_id, status, attempts, id);

alter table public.myfans_quote_refresh_jobs enable row level security;
alter table public.myfans_quote_refresh_job_items enable row level security;

revoke all on table public.myfans_quote_refresh_jobs from anon, authenticated;
revoke all on table public.myfans_quote_refresh_job_items from anon, authenticated;
revoke all on sequence public.myfans_quote_refresh_jobs_id_seq from anon, authenticated;
revoke all on sequence public.myfans_quote_refresh_job_items_id_seq from anon, authenticated;
