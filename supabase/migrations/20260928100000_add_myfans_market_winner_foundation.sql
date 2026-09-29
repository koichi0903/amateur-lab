-- Market Winner foundation. This migration is additive and does not copy
-- account 1 operational rows into account 5.

alter table public.myfans_approved_media
  add column if not exists strategy_type text not null default 'SOURCE'
    check (strategy_type in ('SOURCE', 'MARKET_WINNER'));

update public.myfans_approved_media
set strategy_type = case when account_key = 'fansmy230' then 'MARKET_WINNER' else 'SOURCE' end
where strategy_type is null or strategy_type = 'SOURCE';

create table if not exists public.myfans_market_patterns (
  id bigint generated always as identity primary key,
  pattern_key text not null unique,
  name text not null,
  description text not null default '',
  objective_compatibility jsonb not null default '[]'::jsonb,
  initial_weight numeric(8,4) not null default 1 check (initial_weight >= 0),
  active boolean not null default true,
  requirements jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.myfans_market_opportunities (
  id bigint generated always as identity primary key,
  approved_media_id bigint not null references public.myfans_approved_media(id) on delete cascade,
  pattern_id bigint not null references public.myfans_market_patterns(id) on delete restrict,
  quote_candidate_id bigint references public.myfans_quote_candidates(id) on delete set null,
  product_id bigint references public.myfans_products(id) on delete set null,
  creator_id bigint references public.myfans_creators(id) on delete set null,
  source_x_url text not null default '',
  status text not null default 'candidate'
    check (status in ('candidate', 'selected', 'held', 'dismissed', 'expired', 'converted')),
  winner_score numeric(8,4) not null default 0 check (winner_score >= 0),
  score_components jsonb not null default '{}'::jsonb,
  explanation jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists myfans_market_opportunities_account_pattern_source_product_idx
  on public.myfans_market_opportunities
    (approved_media_id, pattern_id, coalesce(quote_candidate_id, 0), coalesce(product_id, 0));
create index if not exists myfans_market_opportunities_account_score_idx
  on public.myfans_market_opportunities (approved_media_id, status, winner_score desc, generated_at desc);
create index if not exists myfans_market_opportunities_pattern_idx
  on public.myfans_market_opportunities (pattern_id, generated_at desc);

create table if not exists public.myfans_pattern_learning (
  id bigint generated always as identity primary key,
  approved_media_id bigint not null references public.myfans_approved_media(id) on delete cascade,
  pattern_id bigint not null references public.myfans_market_patterns(id) on delete cascade,
  creator_id bigint references public.myfans_creators(id) on delete set null,
  product_id bigint references public.myfans_products(id) on delete set null,
  quote_candidate_id bigint references public.myfans_quote_candidates(id) on delete set null,
  impressions bigint not null default 0 check (impressions >= 0),
  engagements bigint not null default 0 check (engagements >= 0),
  clicks bigint not null default 0 check (clicks >= 0),
  conversions bigint not null default 0 check (conversions >= 0),
  posts_count integer not null default 0 check (posts_count >= 0),
  reward_amount bigint not null default 0 check (reward_amount >= 0),
  posterior_weight numeric(8,4) not null default 1 check (posterior_weight >= 0),
  last_observed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists myfans_pattern_learning_scope_idx
  on public.myfans_pattern_learning
    (approved_media_id, pattern_id, coalesce(creator_id, 0), coalesce(product_id, 0), coalesce(quote_candidate_id, 0));

create table if not exists public.myfans_cross_account_content_guards (
  id bigint generated always as identity primary key,
  approved_media_id bigint references public.myfans_approved_media(id) on delete cascade,
  global_content_fingerprint text not null,
  source_x_url text not null default '',
  product_id bigint references public.myfans_products(id) on delete set null,
  creator_id bigint references public.myfans_creators(id) on delete set null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  cooldown_until timestamptz,
  use_count integer not null default 1 check (use_count > 0),
  guard_reason text not null default '',
  metadata jsonb not null default '{}'::jsonb
);
create unique index if not exists myfans_cross_account_guards_fingerprint_idx
  on public.myfans_cross_account_content_guards (global_content_fingerprint);
create index if not exists myfans_cross_account_guards_source_idx
  on public.myfans_cross_account_content_guards (lower(source_x_url), last_seen_at desc);
create index if not exists myfans_cross_account_guards_product_idx
  on public.myfans_cross_account_content_guards (product_id, last_seen_at desc)
  where product_id is not null;
create index if not exists myfans_cross_account_guards_creator_idx
  on public.myfans_cross_account_content_guards (creator_id, last_seen_at desc)
  where creator_id is not null;

alter table public.myfans_x_posts
  add column if not exists pattern_id bigint references public.myfans_market_patterns(id) on delete set null,
  add column if not exists quote_candidate_id bigint references public.myfans_quote_candidates(id) on delete set null,
  add column if not exists creator_id bigint references public.myfans_creators(id) on delete set null,
  add column if not exists strategy_type text check (strategy_type is null or strategy_type in ('SOURCE', 'MARKET_WINNER')),
  add column if not exists global_content_fingerprint text;
create index if not exists myfans_x_posts_pattern_account_idx
  on public.myfans_x_posts (approved_media_id, pattern_id, created_at desc)
  where pattern_id is not null;
create index if not exists myfans_x_posts_global_fingerprint_idx
  on public.myfans_x_posts (global_content_fingerprint)
  where global_content_fingerprint is not null and global_content_fingerprint <> '';

alter table public.myfans_market_patterns enable row level security;
alter table public.myfans_market_opportunities enable row level security;
alter table public.myfans_pattern_learning enable row level security;
alter table public.myfans_cross_account_content_guards enable row level security;
revoke all on table public.myfans_market_patterns from anon, authenticated;
revoke all on table public.myfans_market_opportunities from anon, authenticated;
revoke all on table public.myfans_pattern_learning from anon, authenticated;
revoke all on table public.myfans_cross_account_content_guards from anon, authenticated;
revoke all on sequence public.myfans_market_patterns_id_seq from anon, authenticated;
revoke all on sequence public.myfans_market_opportunities_id_seq from anon, authenticated;
revoke all on sequence public.myfans_pattern_learning_id_seq from anon, authenticated;
revoke all on sequence public.myfans_cross_account_content_guards_id_seq from anon, authenticated;

insert into public.myfans_market_patterns
  (pattern_key, name, description, objective_compatibility, initial_weight, requirements, metadata)
values
  ('QUOTE_HOOK', 'Quote Hook', '引用元の冒頭フックを起点にする仮説。', '["impression","click"]', 1, '{"requires_quote":true}', '{"prior":"hypothesis"}'),
  ('PRICE_DROP', 'Price Drop', '価格差・値下げを起点にする仮説。', '["click","conversion"]', 1, '{"requires_product":true,"requires_price_signal":true}', '{"prior":"hypothesis"}'),
  ('LIMITED_WINDOW', 'Limited Window', '期間・残り時間を起点にする仮説。', '["click","conversion"]', 1, '{"requires_deadline":true}', '{"prior":"hypothesis"}'),
  ('CREATOR_DISCOVERY', 'Creator Discovery', 'クリエイター発見を起点にする仮説。', '["impression","follow"]', 1, '{"requires_creator":true}', '{"prior":"hypothesis"}'),
  ('COMPARISON', 'Comparison', '2つ以上の選択肢比較を起点にする仮説。', '["click","conversion"]', 1, '{"requires_product":true,"requires_comparison":true}', '{"prior":"hypothesis"}'),
  ('NEW_RELEASE', 'New Release', '新着性を起点にする仮説。', '["impression","click"]', 1, '{"requires_new_release":true}', '{"prior":"hypothesis"}'),
  ('SOCIAL_PROOF', 'Social Proof', '反応・人気などの社会的証明を起点にする仮説。', '["impression","click"]', 1, '{"requires_social_proof":true}', '{"prior":"hypothesis"}'),
  ('CURIOSITY_GAP', 'Curiosity Gap', '未解決の問い・差分を起点にする仮説。', '["impression","click"]', 1, '{"requires_text":true}', '{"prior":"hypothesis"}'),
  ('FOLLOW_SERIES', 'Follow Series', '継続的なシリーズ化を起点にする仮説。', '["follow","impression"]', 1, '{"requires_series":true}', '{"prior":"hypothesis"}')
on conflict (pattern_key) do nothing;
