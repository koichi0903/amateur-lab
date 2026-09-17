create table if not exists public.myfans_visual_verification_jobs (
  id bigserial primary key,
  approved_media_id bigint references public.myfans_approved_media(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'running', 'paused', 'completed', 'cancelled', 'failed')),
  batch_size integer not null default 5 check (batch_size between 1 and 10),
  total_sources integer not null default 0,
  processed_sources integer not null default 0,
  verified_count integer not null default 0,
  partial_count integer not null default 0,
  unavailable_count integer not null default 0,
  consecutive_gate_failures integer not null default 0,
  analyzer_version text,
  last_error text,
  stopped_reason text,
  started_at timestamptz,
  paused_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.myfans_visual_verification_queue (
  id bigserial primary key,
  job_id bigint not null references public.myfans_visual_verification_jobs(id) on delete cascade,
  quote_candidate_id bigint not null references public.myfans_quote_candidates(id) on delete cascade,
  source_url text not null,
  creator_id bigint references public.myfans_creators(id) on delete set null,
  media_type text not null default 'none',
  status text not null default 'pending' check (status in ('pending', 'processing', 'verified', 'partial', 'unavailable', 'skipped')),
  visual_render_status text,
  result_json jsonb not null default '{}'::jsonb,
  analyzer_version text,
  attempt_count integer not null default 0,
  last_reason text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, source_url)
);

create index if not exists myfans_visual_verification_queue_pending_idx
  on public.myfans_visual_verification_queue (job_id, status, id);
create index if not exists myfans_visual_verification_queue_candidate_idx
  on public.myfans_visual_verification_queue (quote_candidate_id, created_at desc);

alter table public.myfans_visual_verification_jobs enable row level security;
alter table public.myfans_visual_verification_queue enable row level security;
revoke all on table public.myfans_visual_verification_jobs from anon, authenticated;
revoke all on table public.myfans_visual_verification_queue from anon, authenticated;
revoke all on sequence public.myfans_visual_verification_jobs_id_seq from anon, authenticated;
revoke all on sequence public.myfans_visual_verification_queue_id_seq from anon, authenticated;
