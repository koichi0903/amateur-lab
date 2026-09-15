alter table public.myfans_quote_candidates
  add column if not exists visual_analysis_status text not null default 'unavailable'
    check (visual_analysis_status in ('verified', 'partial', 'unavailable')),
  add column if not exists visual_analysis_json jsonb not null default '{}'::jsonb,
  add column if not exists visual_analyzed_at timestamptz,
  add column if not exists visual_analyzer_version text;

create index if not exists myfans_quote_candidates_visual_analysis_idx
  on public.myfans_quote_candidates (visual_analysis_status, visual_analyzer_version, visual_score desc, score desc, collected_at desc);

alter table public.myfans_quote_candidates enable row level security;
revoke all on table public.myfans_quote_candidates from anon, authenticated;
revoke all on sequence public.myfans_quote_candidates_id_seq from anon, authenticated;
