alter table public.x_post_logs
  add column if not exists creative_variant_id text,
  add column if not exists hook_type text,
  add column if not exists image_strategy text,
  add column if not exists link_strategy text,
  add column if not exists cta_strategy text;

create index if not exists x_post_logs_creative_variant_posted_at_idx
  on public.x_post_logs (creative_variant_id, posted_at desc);

create index if not exists x_post_logs_hook_type_posted_at_idx
  on public.x_post_logs (hook_type, posted_at desc);

create index if not exists x_post_logs_image_strategy_posted_at_idx
  on public.x_post_logs (image_strategy, posted_at desc);

create index if not exists x_post_logs_link_strategy_posted_at_idx
  on public.x_post_logs (link_strategy, posted_at desc);

create index if not exists x_post_logs_cta_strategy_posted_at_idx
  on public.x_post_logs (cta_strategy, posted_at desc);
