alter table public.myfans_x_posts
  add column if not exists approved_media_id bigint references public.myfans_approved_media(id) on delete set null,
  add column if not exists approved_media_name text not null default '',
  add column if not exists growth_stage text not null default ''
    check (growth_stage in ('', 'day_1_7', 'day_8_14', 'day_15_30')),
  add column if not exists link_strategy text not null default 'no_link'
    check (link_strategy in ('body_link', 'reply_link', 'profile_cta', 'no_link')),
  add column if not exists cta_strategy text not null default '',
  add column if not exists creative_variant_id text not null default '',
  add column if not exists planned_slot text not null default '',
  add column if not exists objective text not null default 'impression'
    check (objective in ('impression', 'profile_visit', 'follow', 'click', 'conversion'));

alter table public.myfans_x_posts
  drop constraint if exists myfans_x_posts_post_type_check;

alter table public.myfans_x_posts
  add constraint myfans_x_posts_post_type_check
  check (post_type in (
    'discovery',
    'comparison',
    'avoid_bad_buy',
    'new_creator',
    'single_intro',
    'trend',
    'profile_cta',
    'review_summary',
    'winner_reuse',
    'other'
  ));

create index if not exists myfans_x_posts_growth_strategy_idx
  on public.myfans_x_posts (growth_stage, link_strategy, post_type, posted_at desc);

revoke all on table public.myfans_x_posts from anon, authenticated;
