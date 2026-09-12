alter table public.myfans_products
  add column if not exists approved_media_name text not null default '',
  add column if not exists approved_media_url text not null default '',
  add column if not exists affiliate_media_id text not null default '',
  add column if not exists selection_score integer not null default 0 check (selection_score >= 0 and selection_score <= 100),
  add column if not exists launch_priority text not null default 'medium'
    check (launch_priority in ('high', 'medium', 'low')),
  add column if not exists last_reviewed_at timestamptz;

alter table public.myfans_x_posts
  add column if not exists actual_posted_by text not null default '',
  add column if not exists external_metrics_checked_at timestamptz,
  add column if not exists clicks integer not null default 0 check (clicks >= 0);

create table if not exists public.myfans_approved_media (
  id bigint generated always as identity primary key,
  media_name text not null,
  media_url text not null default '',
  affiliate_media_id text not null default '',
  status text not null default 'active'
    check (status in ('active', 'paused', 'ended')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists myfans_approved_media_name_idx
  on public.myfans_approved_media (media_name);

create table if not exists public.myfans_audit_logs (
  id bigint generated always as identity primary key,
  entity_type text not null
    check (entity_type in ('creator', 'product', 'x_post', 'conversion', 'click', 'media', 'import')),
  entity_id bigint,
  action text not null,
  summary text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists myfans_audit_logs_entity_idx
  on public.myfans_audit_logs (entity_type, entity_id, created_at desc);

create index if not exists myfans_products_selection_score_idx
  on public.myfans_products (selection_score desc, launch_priority, created_at desc);

alter table public.myfans_approved_media enable row level security;
alter table public.myfans_audit_logs enable row level security;

revoke all on table public.myfans_approved_media from anon, authenticated;
revoke all on table public.myfans_audit_logs from anon, authenticated;
revoke all on sequence public.myfans_approved_media_id_seq from anon, authenticated;
revoke all on sequence public.myfans_audit_logs_id_seq from anon, authenticated;
