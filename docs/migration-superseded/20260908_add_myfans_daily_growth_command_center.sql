create table if not exists public.myfans_daily_plans (
  id bigserial primary key,
  approved_media_id bigint references public.myfans_approved_media(id) on delete set null,
  plan_date date not null,
  operation_day integer not null default 1,
  stage text not null,
  plan_key text not null,
  strategy_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (approved_media_id, plan_date)
);

create table if not exists public.myfans_daily_plan_posts (
  id bigserial primary key,
  daily_plan_id bigint not null references public.myfans_daily_plans(id) on delete cascade,
  product_id bigint references public.myfans_products(id) on delete set null,
  quote_candidate_id bigint references public.myfans_quote_candidates(id) on delete set null,
  post_order integer not null,
  post_role text not null,
  audience_intent text not null,
  hook_type text not null,
  creative_strategy text not null,
  quality_score integer not null default 0,
  quality_verdict text not null default 'HOLD',
  evidence_json jsonb not null default '{}'::jsonb,
  body text not null default '',
  self_reply text not null default '',
  created_at timestamptz not null default now(),
  unique (daily_plan_id, post_order)
);

create table if not exists public.myfans_attention_candidates (
  id bigserial primary key,
  approved_media_id bigint references public.myfans_approved_media(id) on delete set null,
  quote_candidate_id bigint references public.myfans_quote_candidates(id) on delete cascade,
  product_id bigint references public.myfans_products(id) on delete set null,
  plan_date date not null,
  attention_score integer not null default 0,
  score_json jsonb not null default '{}'::jsonb,
  evidence_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (approved_media_id, quote_candidate_id, plan_date)
);

create table if not exists public.myfans_outbound_tasks (
  id bigserial primary key,
  approved_media_id bigint references public.myfans_approved_media(id) on delete set null,
  plan_date date not null,
  task_type text not null,
  target_url text not null default '',
  reason text not null default '',
  suggested_text text not null default '',
  status text not null default 'candidate',
  created_at timestamptz not null default now()
);

create index if not exists myfans_daily_plan_posts_plan_order_idx
  on public.myfans_daily_plan_posts (daily_plan_id, post_order);

create index if not exists myfans_attention_candidates_media_date_score_idx
  on public.myfans_attention_candidates (approved_media_id, plan_date, attention_score desc);

create index if not exists myfans_outbound_tasks_media_date_idx
  on public.myfans_outbound_tasks (approved_media_id, plan_date, created_at);

alter table public.myfans_daily_plans enable row level security;
alter table public.myfans_daily_plan_posts enable row level security;
alter table public.myfans_attention_candidates enable row level security;
alter table public.myfans_outbound_tasks enable row level security;

revoke all on table public.myfans_daily_plans from anon, authenticated;
revoke all on table public.myfans_daily_plan_posts from anon, authenticated;
revoke all on table public.myfans_attention_candidates from anon, authenticated;
revoke all on table public.myfans_outbound_tasks from anon, authenticated;

revoke all on sequence public.myfans_daily_plans_id_seq from anon, authenticated;
revoke all on sequence public.myfans_daily_plan_posts_id_seq from anon, authenticated;
revoke all on sequence public.myfans_attention_candidates_id_seq from anon, authenticated;
revoke all on sequence public.myfans_outbound_tasks_id_seq from anon, authenticated;
