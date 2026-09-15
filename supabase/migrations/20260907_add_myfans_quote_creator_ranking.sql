alter table public.myfans_quote_candidates
  alter column product_id drop not null;

alter table public.myfans_quote_candidates
  add column if not exists creator_rank integer check (creator_rank is null or creator_rank > 0),
  add column if not exists global_score integer check (global_score is null or (global_score >= 0 and global_score <= 120)),
  add column if not exists global_rank integer check (global_rank is null or global_rank > 0),
  add column if not exists last_used_at timestamptz,
  add column if not exists use_count integer not null default 0 check (use_count >= 0),
  add column if not exists cooldown_until timestamptz,
  add column if not exists selected_for_today boolean not null default false;

drop index if exists myfans_quote_candidates_selected_product_idx;

create unique index if not exists myfans_quote_candidates_product_post_idx
  on public.myfans_quote_candidates (product_id, x_post_url)
  where product_id is not null;

create unique index if not exists myfans_quote_candidates_creator_post_idx
  on public.myfans_quote_candidates (creator_id, x_post_url)
  where creator_id is not null;

create index if not exists myfans_quote_candidates_creator_rank_idx
  on public.myfans_quote_candidates (creator_id, creator_rank, score desc, collected_at desc);

create index if not exists myfans_quote_candidates_global_rank_idx
  on public.myfans_quote_candidates (approved_media_id, global_rank, global_score desc, collected_at desc)
  where selected_for_today;

revoke all on table public.myfans_quote_candidates from anon, authenticated;
revoke all on sequence public.myfans_quote_candidates_id_seq from anon, authenticated;
