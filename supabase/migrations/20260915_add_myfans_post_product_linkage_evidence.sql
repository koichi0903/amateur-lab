create table if not exists public.myfans_post_product_linkage_evidence (
  id bigserial primary key,
  approved_media_id bigint references public.myfans_approved_media(id) on delete set null,
  quote_candidate_id bigint references public.myfans_quote_candidates(id) on delete set null,
  source_status_url text not null,
  source_author_handle text not null default '',
  discovered_myfans_url text not null default '',
  final_myfans_url text,
  product_id bigint references public.myfans_products(id) on delete set null,
  resolution_method text not null,
  confidence text not null,
  evidence_source text not null,
  verified_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint myfans_post_product_linkage_confidence_chk
    check (confidence in ('exact', 'strong', 'unresolved')),
  constraint myfans_post_product_linkage_evidence_source_chk
    check (evidence_source in ('author_post', 'author_reply', 'db_existing'))
);

create unique index if not exists myfans_post_product_linkage_source_url_idx
  on public.myfans_post_product_linkage_evidence (source_status_url, discovered_myfans_url, evidence_source);

create index if not exists myfans_post_product_linkage_product_idx
  on public.myfans_post_product_linkage_evidence (product_id, confidence, verified_at desc)
  where product_id is not null;

create index if not exists myfans_post_product_linkage_author_idx
  on public.myfans_post_product_linkage_evidence (source_author_handle, confidence, verified_at desc);

alter table public.myfans_post_product_linkage_evidence enable row level security;

revoke all on table public.myfans_post_product_linkage_evidence from anon, authenticated;
revoke all on sequence public.myfans_post_product_linkage_evidence_id_seq from anon, authenticated;
