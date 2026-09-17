alter table public.myfans_post_product_linkage_evidence
  add column if not exists diagnostic_mode boolean not null default false;

alter table public.myfans_post_product_linkage_evidence
  add column if not exists diagnostic_run_id text;

create index if not exists myfans_post_product_linkage_diagnostic_idx
  on public.myfans_post_product_linkage_evidence (diagnostic_mode, verified_at desc);
