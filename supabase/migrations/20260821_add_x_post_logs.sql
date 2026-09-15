create table if not exists public.x_post_logs (
  id bigserial primary key,
  post_key text not null,
  work_id bigint not null,
  category text not null check (category in ('sales', 'deal', 'score', 'new')),
  title text not null,
  post_text text not null,
  post_date date not null default ((now() at time zone 'Asia/Tokyo')::date),
  posted_at timestamptz not null default now()
);

create unique index if not exists x_post_logs_post_key_post_date_idx
  on public.x_post_logs (post_key, post_date);

create index if not exists x_post_logs_work_id_posted_at_idx
  on public.x_post_logs (work_id, posted_at desc);

create index if not exists x_post_logs_posted_at_idx
  on public.x_post_logs (posted_at desc);

alter table public.x_post_logs enable row level security;

revoke all on table public.x_post_logs from anon, authenticated;
revoke all on sequence public.x_post_logs_id_seq from anon, authenticated;
