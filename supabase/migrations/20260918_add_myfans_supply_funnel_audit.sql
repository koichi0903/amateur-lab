create table if not exists public.myfans_daily_plan_funnel_audit (
  id bigserial primary key,
  daily_plan_id bigint not null references public.myfans_daily_plans(id) on delete cascade,
  plan_date date not null,
  revision integer,
  audit_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists myfans_daily_plan_funnel_audit_plan_idx
  on public.myfans_daily_plan_funnel_audit (daily_plan_id, created_at desc);

alter table public.myfans_daily_plan_funnel_audit enable row level security;
revoke all on table public.myfans_daily_plan_funnel_audit from anon, authenticated;
revoke all on sequence public.myfans_daily_plan_funnel_audit_id_seq from anon, authenticated;
