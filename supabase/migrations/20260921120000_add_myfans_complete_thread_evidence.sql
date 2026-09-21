alter table public.myfans_quote_candidates
  add column if not exists parent_status_url text,
  add column if not exists parent_status_id text,
  add column if not exists own_reply_status_url text,
  add column if not exists own_reply_status_id text,
  add column if not exists myfans_link_source text,
  add column if not exists thread_collection_status text not null default 'LEGACY',
  add column if not exists collector_method text not null default 'legacy_profile_scan',
  add column if not exists resolved_product_evidence jsonb not null default '{}'::jsonb;

alter table public.myfans_quote_candidates
  add constraint myfans_quote_candidates_link_source_chk
  check (myfans_link_source is null or myfans_link_source in ('parent', 'own_reply'));

create index if not exists myfans_quote_candidates_thread_status_idx
  on public.myfans_quote_candidates (thread_collection_status, collected_at desc);

alter table public.myfans_quote_candidates enable row level security;
revoke all on table public.myfans_quote_candidates from anon, authenticated;
revoke all on sequence public.myfans_quote_candidates_id_seq from anon, authenticated;
