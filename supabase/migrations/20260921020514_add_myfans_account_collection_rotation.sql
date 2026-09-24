create table if not exists public.myfans_creator_collection_state (
  creator_id bigint primary key references public.myfans_creators(id) on delete restrict,
  rotation_order integer not null unique,
  collection_enabled boolean not null default true,
  state text not null default 'ELIGIBLE',
  exclusion_reason text,
  excluded_at timestamp with time zone,
  last_processed_at timestamp with time zone,
  last_run_id bigint,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint myfans_creator_collection_state_state_chk check (state in ('ELIGIBLE','NO_MATCH_THIS_RUN','NO_POSTS','PRIVATE','TEMP_ERROR','BLOCKED','THREAD_INCOMPLETE','INVALID','MISSING_X_URL')),
  constraint myfans_creator_collection_state_exclusion_chk check ((collection_enabled and exclusion_reason is null and excluded_at is null) or (not collection_enabled and state in ('NO_POSTS','PRIVATE')))
);

create table if not exists public.myfans_collection_cursors (
  collector_key text primary key,
  cursor_order integer not null default 0,
  cycle_no integer not null default 1,
  cycle_started_at timestamp with time zone not null default now(),
  last_run_at timestamp with time zone,
  updated_at timestamp with time zone not null default now()
);

alter table public.myfans_quote_refresh_jobs
  add column if not exists collection_cycle_no integer not null default 1,
  add column if not exists cursor_before_order integer not null default 0,
  add column if not exists cursor_after_order integer,
  add column if not exists cycle_completed boolean not null default false,
  add column if not exists accounts_processed integer not null default 0,
  add column if not exists complete_threads_found integer not null default 0,
  add column if not exists candidates_saved integer not null default 0,
  add column if not exists no_match integer not null default 0,
  add column if not exists excluded_no_posts integer not null default 0,
  add column if not exists excluded_private integer not null default 0,
  add column if not exists retryable_errors integer not null default 0;

alter table public.myfans_quote_refresh_job_items
  add column if not exists collection_state text,
  add column if not exists collection_evidence jsonb not null default '{}'::jsonb;

create index if not exists myfans_creator_collection_state_enabled_order_idx
  on public.myfans_creator_collection_state (collection_enabled, rotation_order);
create index if not exists myfans_creator_collection_state_state_idx
  on public.myfans_creator_collection_state (state, updated_at desc);

alter table public.myfans_creator_collection_state enable row level security;
alter table public.myfans_collection_cursors enable row level security;
revoke all on table public.myfans_creator_collection_state from anon, authenticated;
revoke all on table public.myfans_collection_cursors from anon, authenticated;

insert into public.myfans_collection_cursors (collector_key)
values ('myfans_quote_refresh')
on conflict (collector_key) do nothing;

insert into public.myfans_creator_collection_state (creator_id, rotation_order, collection_enabled, state)
select id, row_number() over (order by id)::integer, true, 'ELIGIBLE'
from public.myfans_creators
where is_active and creator_x_url <> ''
on conflict (creator_id) do nothing;
