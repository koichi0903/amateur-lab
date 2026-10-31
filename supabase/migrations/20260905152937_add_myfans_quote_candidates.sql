create table if not exists public.myfans_quote_candidates (
  id bigint generated always as identity primary key,
  approved_media_id bigint references public.myfans_approved_media(id) on delete set null,
  creator_id bigint references public.myfans_creators(id) on delete set null,
  product_id bigint not null references public.myfans_products(id) on delete cascade,
  creator_x_url text not null default '',
  source_x_handle text not null default '',
  x_post_url text not null,
  posted_at timestamptz,
  text_excerpt text not null default '',
  views integer check (views is null or views >= 0),
  likes integer check (likes is null or likes >= 0),
  reposts integer check (reposts is null or reposts >= 0),
  replies integer check (replies is null or replies >= 0),
  bookmarks integer check (bookmarks is null or bookmarks >= 0),
  has_image boolean not null default false,
  has_video boolean not null default false,
  is_pinned boolean not null default false,
  is_reply boolean not null default false,
  is_repost boolean not null default false,
  is_quote boolean not null default false,
  collected_at timestamptz not null default now(),
  score integer not null default 0 check (score >= 0 and score <= 100),
  score_reason text not null default '',
  selected boolean not null default false,
  created_at timestamptz not null default now(),
  unique (product_id, x_post_url)
);

alter table public.myfans_quote_candidates enable row level security;
revoke all on table public.myfans_quote_candidates from anon, authenticated;
revoke all on sequence public.myfans_quote_candidates_id_seq from anon, authenticated;

create unique index if not exists myfans_quote_candidates_selected_product_idx
  on public.myfans_quote_candidates (product_id)
  where selected;

create index if not exists myfans_quote_candidates_product_score_idx
  on public.myfans_quote_candidates (product_id, score desc, collected_at desc);

create index if not exists myfans_quote_candidates_media_collected_idx
  on public.myfans_quote_candidates (approved_media_id, collected_at desc);
