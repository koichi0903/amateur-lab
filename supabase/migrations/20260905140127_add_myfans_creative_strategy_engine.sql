alter table public.myfans_creators
  add column if not exists creator_x_url text not null default '',
  add column if not exists source_x_handle text not null default '',
  add column if not exists latest_quote_x_url text not null default '';

alter table public.myfans_products
  add column if not exists creator_x_url text not null default '',
  add column if not exists quote_candidate_x_url text not null default '',
  add column if not exists media_permission_status text not null default 'unknown'
    check (media_permission_status in ('unknown', 'not_allowed', 'permitted_image', 'permitted_video', 'permitted_image_video')),
  add column if not exists media_permission_note text not null default '';

alter table public.myfans_x_posts
  add column if not exists creative_strategy text not null default 'text_only'
    check (creative_strategy in ('quote_post', 'myfans_ogp', 'comparison_card', 'ranking_card', 'discovery_card', 'revenue_data_card', 'text_only', 'permitted_media')),
  add column if not exists creative_reason text not null default '',
  add column if not exists card_payload jsonb not null default '{}'::jsonb,
  add column if not exists ogp_check_required boolean not null default false,
  add column if not exists quote_x_url text not null default '',
  add column if not exists media_permission_status text not null default 'unknown'
    check (media_permission_status in ('unknown', 'not_allowed', 'permitted_image', 'permitted_video', 'permitted_image_video'));

create index if not exists myfans_x_posts_creative_strategy_idx
  on public.myfans_x_posts (creative_strategy, posted_at desc, created_at desc);

create index if not exists myfans_products_quote_candidate_idx
  on public.myfans_products (quote_candidate_x_url)
  where quote_candidate_x_url <> '';

revoke all on table public.myfans_creators from anon, authenticated;
revoke all on table public.myfans_products from anon, authenticated;
revoke all on table public.myfans_x_posts from anon, authenticated;
