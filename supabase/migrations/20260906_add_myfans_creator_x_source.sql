alter table public.myfans_creators
  add column if not exists x_url_source text not null default '',
  add column if not exists x_url_conflict jsonb;

create index if not exists myfans_creators_creator_x_url_idx
  on public.myfans_creators (creator_x_url)
  where creator_x_url <> '';

alter table public.myfans_creators enable row level security;
revoke all on table public.myfans_creators from anon, authenticated;
revoke all on sequence public.myfans_creators_id_seq from anon, authenticated;
