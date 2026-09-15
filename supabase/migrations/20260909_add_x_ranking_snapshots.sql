create table if not exists public.x_ranking_snapshots (
  id bigserial primary key,
  account_handle text not null default 'hakkutsu_lab',
  work_id bigint references public.works(id) on delete cascade,
  product_id text,
  ranking integer check (ranking > 0),
  source text not null default 'growth_os',
  captured_date date not null default (now() at time zone 'Asia/Tokyo')::date,
  captured_at timestamptz not null default now(),
  unique (account_handle, work_id, captured_date)
);

create index if not exists x_ranking_snapshots_work_date_idx
  on public.x_ranking_snapshots (work_id, captured_date desc);

alter table public.x_ranking_snapshots enable row level security;

revoke all on table public.x_ranking_snapshots from anon, authenticated;
revoke all on sequence public.x_ranking_snapshots_id_seq from anon, authenticated;
