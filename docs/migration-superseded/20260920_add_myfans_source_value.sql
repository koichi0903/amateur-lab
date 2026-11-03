alter table public.myfans_quote_candidates
  add column if not exists source_value_score integer,
  add column if not exists source_value_verdict text,
  add column if not exists source_value_reasons jsonb not null default '[]'::jsonb,
  add column if not exists reaction_angles jsonb not null default '[]'::jsonb,
  add column if not exists source_specificity integer;

alter table public.myfans_quote_candidates
  add constraint myfans_quote_candidates_source_value_score_chk
  check (source_value_score is null or source_value_score between 0 and 100);

alter table public.myfans_quote_candidates enable row level security;
revoke all on table public.myfans_quote_candidates from anon, authenticated;
revoke all on sequence public.myfans_quote_candidates_id_seq from anon, authenticated;

create index if not exists myfans_quote_candidates_source_value_idx
  on public.myfans_quote_candidates (source_value_verdict, source_value_score desc, collected_at desc);
