alter table public.x_post_logs
  add column if not exists account_handle text not null default 'hakkutsu_lab',
  add column if not exists post_intent text not null default 'work_link',
  add column if not exists scheduled_slot text,
  add column if not exists planned_at timestamptz,
  add column if not exists reply_posted_at timestamptz,
  add column if not exists evaluation_due_at timestamptz,
  add column if not exists impressions_24h integer not null default 0 check (impressions_24h >= 0),
  add column if not exists engagements_24h integer not null default 0 check (engagements_24h >= 0),
  add column if not exists profile_visits_24h integer not null default 0 check (profile_visits_24h >= 0),
  add column if not exists follows_24h integer not null default 0 check (follows_24h >= 0),
  add column if not exists reposts_24h integer not null default 0 check (reposts_24h >= 0),
  add column if not exists replies_24h integer not null default 0 check (replies_24h >= 0),
  add column if not exists learning_note text not null default '';

alter table public.x_post_logs
  add column if not exists x_post_id text,
  add column if not exists opportunity_id bigint,
  add column if not exists media_asset_id bigint,
  add column if not exists creative_genome jsonb;

create index if not exists x_post_logs_account_posted_at_idx
  on public.x_post_logs (account_handle, posted_at desc);

create index if not exists x_post_logs_intent_posted_at_idx
  on public.x_post_logs (post_intent, posted_at desc);

create index if not exists x_post_logs_evaluation_due_idx
  on public.x_post_logs (evaluation_due_at)
  where evaluation_due_at is not null;

create table if not exists public.x_growth_opportunities (
  id bigserial primary key,
  account_handle text not null default 'hakkutsu_lab',
  opportunity_key text not null,
  work_id bigint references public.works(id) on delete set null,
  product_id text,
  opportunity_date date not null default (now() at time zone 'Asia/Tokyo')::date,
  event_type text not null check (event_type in ('price_anomaly','ranking_velocity','review_anomaly','hidden_gem','traffic_velocity','creator_trend','series_trend','genre_trend')),
  topic text not null,
  intent text not null check (intent in ('REACH','FOLLOW','AUTHORITY','MONEY','CONVERSATION')),
  reach_score integer not null default 0 check (reach_score between 0 and 100),
  follow_score integer not null default 0 check (follow_score between 0 and 100),
  authority_score integer not null default 0 check (authority_score between 0 and 100),
  revenue_score integer not null default 0 check (revenue_score between 0 and 100),
  evidence jsonb not null default '[]'::jsonb,
  recommended_media_asset_id bigint,
  post_text text,
  reply_text text,
  post_intent text not null default 'work_link',
  media_type text not null default 'text' check (media_type in ('existing_link_image','sample_movie','data_card','text','quote')),
  score_breakdown jsonb not null default '{}'::jsonb,
  creative_genome jsonb not null default '{}'::jsonb,
  adoption_reason text,
  x_post_id text,
  posted_at timestamptz,
  status text not null default 'candidate' check (status in ('candidate','adopted','rejected','posted','expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_handle, opportunity_key, opportunity_date)
);

create table if not exists public.x_growth_daily_plans (
  id bigserial primary key,
  account_handle text not null default 'hakkutsu_lab',
  plan_date date not null,
  primary_bottleneck text not null,
  mission_title text not null,
  mission_reason text not null,
  target_mix jsonb not null default '{}'::jsonb,
  recommended_actions jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft','confirmed','completed','regenerated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_handle, plan_date)
);

create table if not exists public.x_media_assets (
  id bigserial primary key,
  account_handle text not null default 'hakkutsu_lab',
  work_id bigint references public.works(id) on delete cascade,
  product_id text,
  media_type text not null,
  source_url text not null,
  technical_status text not null default 'unchecked',
  rights_status text not null default 'unchecked' check (rights_status in ('unchecked','allowed','rejected','expired')),
  x_usage_allowed boolean not null default false,
  rights_checked_at timestamptz,
  rights_source text,
  can_trim boolean not null default false,
  can_overlay boolean not null default false,
  can_reupload boolean not null default false,
  quote_only boolean not null default true,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_handle, work_id, media_type, source_url)
);

create table if not exists public.x_metric_snapshots (
  id bigserial primary key,
  account_handle text not null default 'hakkutsu_lab',
  x_post_log_id bigint references public.x_post_logs(id) on delete cascade,
  post_key text not null,
  snapshot_age text not null check (snapshot_age in ('1h','6h','24h','72h')),
  captured_at timestamptz not null default now(),
  source text not null default 'manual' check (source in ('manual','x_api','internal_logs')),
  impressions integer not null default 0 check (impressions >= 0),
  likes integer not null default 0 check (likes >= 0),
  replies integer not null default 0 check (replies >= 0),
  reposts integer not null default 0 check (reposts >= 0),
  bookmarks integer not null default 0 check (bookmarks >= 0),
  profile_visits integer not null default 0 check (profile_visits >= 0),
  follows integer not null default 0 check (follows >= 0),
  link_clicks integer not null default 0 check (link_clicks >= 0),
  site_visits integer not null default 0 check (site_visits >= 0),
  affiliate_clicks integer not null default 0 check (affiliate_clicks >= 0),
  notes text not null default '',
  unique (post_key, snapshot_age)
);

create table if not exists public.x_creative_learning (
  id bigserial primary key,
  account_handle text not null default 'hakkutsu_lab',
  post_key text,
  work_id bigint references public.works(id) on delete set null,
  topic text not null,
  intent text not null check (intent in ('REACH','FOLLOW','AUTHORITY','MONEY','CONVERSATION')),
  hook text not null,
  proof text not null,
  structure text not null,
  emotion text not null,
  length_bucket text not null,
  media text not null,
  cta text not null,
  link_strategy text not null,
  posting_slot text not null,
  outcome_summary jsonb not null default '{}'::jsonb,
  learning_note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.x_conversation_radar (
  id bigserial primary key,
  account_handle text not null default 'hakkutsu_lab',
  target_type text not null check (target_type in ('work','actress','maker','series','genre','post')),
  target_name text not null,
  target_handle text,
  topic text not null,
  source_url text,
  suggested_reply text not null default '',
  status text not null default 'candidate' check (status in ('candidate','adopted','rejected','used','expired')),
  external_status text not null default 'unavailable' check (external_status in ('available','unavailable')),
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_handle, target_type, target_name, topic)
);

alter table public.x_growth_opportunities
  add column if not exists opportunity_key text,
  add column if not exists post_text text,
  add column if not exists reply_text text,
  add column if not exists post_intent text not null default 'work_link',
  add column if not exists media_type text not null default 'text',
  add column if not exists score_breakdown jsonb not null default '{}'::jsonb,
  add column if not exists creative_genome jsonb not null default '{}'::jsonb,
  add column if not exists adoption_reason text,
  add column if not exists x_post_id text,
  add column if not exists posted_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

update public.x_growth_opportunities
set opportunity_key = coalesce(opportunity_key, concat(coalesce(product_id, 'work'), '-', coalesce(work_id::text, id::text), '-', event_type))
where opportunity_key is null;

alter table public.x_growth_opportunities
  alter column opportunity_key set not null;

alter table public.x_media_assets
  add column if not exists rights_status text not null default 'unchecked';

alter table public.x_conversation_radar
  add column if not exists external_status text not null default 'unavailable',
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists x_growth_opportunities_dedupe_idx
  on public.x_growth_opportunities (account_handle, opportunity_key, opportunity_date);

create unique index if not exists x_conversation_radar_dedupe_idx
  on public.x_conversation_radar (account_handle, target_type, target_name, topic);

create table if not exists public.x_growth_audit_logs (
  id bigserial primary key,
  account_handle text not null default 'hakkutsu_lab',
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists x_growth_daily_plans_updated_at on public.x_growth_daily_plans;
create trigger x_growth_daily_plans_updated_at before update on public.x_growth_daily_plans
  for each row execute function public.set_updated_at();

drop trigger if exists x_growth_opportunities_updated_at on public.x_growth_opportunities;
create trigger x_growth_opportunities_updated_at before update on public.x_growth_opportunities
  for each row execute function public.set_updated_at();

drop trigger if exists x_media_assets_updated_at on public.x_media_assets;
create trigger x_media_assets_updated_at before update on public.x_media_assets
  for each row execute function public.set_updated_at();

drop trigger if exists x_conversation_radar_updated_at on public.x_conversation_radar;
create trigger x_conversation_radar_updated_at before update on public.x_conversation_radar
  for each row execute function public.set_updated_at();

create index if not exists x_growth_opportunities_account_date_score_idx
  on public.x_growth_opportunities (account_handle, opportunity_date desc, reach_score desc, revenue_score desc);

create index if not exists x_growth_opportunities_status_idx
  on public.x_growth_opportunities (account_handle, status, updated_at desc);

create index if not exists x_media_assets_work_allowed_idx
  on public.x_media_assets (work_id, x_usage_allowed, media_type);

create index if not exists x_metric_snapshots_post_age_idx
  on public.x_metric_snapshots (post_key, snapshot_age);

create index if not exists x_creative_learning_account_created_idx
  on public.x_creative_learning (account_handle, created_at desc);

create index if not exists x_conversation_radar_account_status_idx
  on public.x_conversation_radar (account_handle, status, created_at desc);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'x_post_logs_opportunity_id_fkey') then
    alter table public.x_post_logs
      add constraint x_post_logs_opportunity_id_fkey foreign key (opportunity_id) references public.x_growth_opportunities(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'x_post_logs_media_asset_id_fkey') then
    alter table public.x_post_logs
      add constraint x_post_logs_media_asset_id_fkey foreign key (media_asset_id) references public.x_media_assets(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'x_growth_opportunities_recommended_media_asset_id_fkey') then
    alter table public.x_growth_opportunities
      add constraint x_growth_opportunities_recommended_media_asset_id_fkey foreign key (recommended_media_asset_id) references public.x_media_assets(id) on delete set null;
  end if;
end;
$$;

alter table public.x_growth_opportunities enable row level security;
alter table public.x_growth_daily_plans enable row level security;
alter table public.x_media_assets enable row level security;
alter table public.x_metric_snapshots enable row level security;
alter table public.x_creative_learning enable row level security;
alter table public.x_conversation_radar enable row level security;
alter table public.x_growth_audit_logs enable row level security;

revoke all on table public.x_growth_opportunities from anon, authenticated;
revoke all on table public.x_growth_daily_plans from anon, authenticated;
revoke all on table public.x_media_assets from anon, authenticated;
revoke all on table public.x_metric_snapshots from anon, authenticated;
revoke all on table public.x_creative_learning from anon, authenticated;
revoke all on table public.x_conversation_radar from anon, authenticated;
revoke all on table public.x_growth_audit_logs from anon, authenticated;

revoke all on sequence public.x_growth_opportunities_id_seq from anon, authenticated;
revoke all on sequence public.x_growth_daily_plans_id_seq from anon, authenticated;
revoke all on sequence public.x_media_assets_id_seq from anon, authenticated;
revoke all on sequence public.x_metric_snapshots_id_seq from anon, authenticated;
revoke all on sequence public.x_creative_learning_id_seq from anon, authenticated;
revoke all on sequence public.x_conversation_radar_id_seq from anon, authenticated;
revoke all on sequence public.x_growth_audit_logs_id_seq from anon, authenticated;
