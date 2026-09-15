alter table public.myfans_quote_candidates
  add column if not exists media_permalink text,
  add column if not exists media_type text not null default 'none'
    check (media_type in ('image', 'video', 'none')),
  add column if not exists media_count integer not null default 0
    check (media_count >= 0),
  add column if not exists quote_visual_ready boolean not null default false,
  add column if not exists media_permalink_verified_at timestamptz,
  add column if not exists media_permalink_validation_status text,
  add column if not exists visual_score integer not null default 0
    check (visual_score >= 0 and visual_score <= 100);

create index if not exists myfans_quote_candidates_visual_ready_idx
  on public.myfans_quote_candidates (quote_visual_ready, media_type, visual_score desc, score desc, collected_at desc);

create index if not exists myfans_quote_candidates_media_permalink_idx
  on public.myfans_quote_candidates (media_permalink)
  where media_permalink is not null;

alter table public.myfans_quote_candidates enable row level security;
revoke all on table public.myfans_quote_candidates from anon, authenticated;
revoke all on sequence public.myfans_quote_candidates_id_seq from anon, authenticated;
