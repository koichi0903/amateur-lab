create table public.bluesky_sample_work_registry (
  content_id text primary key check (content_id ~ '^[a-z0-9][a-z0-9_-]{2,79}$'),
  title text not null,
  api_date text,
  api_url text not null,
  image_url jsonb,
  sample_image_url jsonb,
  sample_movie_url jsonb,
  mp4_url text,
  mp4_status text not null default 'pending' check (mp4_status in ('pending', 'found')),
  registered_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bluesky_sample_work_registry_mp4_state_check check (
    (mp4_status = 'found' and mp4_url is not null)
    or (mp4_status = 'pending' and mp4_url is null)
  )
);

alter table public.bluesky_sample_work_registry enable row level security;
revoke all privileges on table public.bluesky_sample_work_registry from public, anon, authenticated, service_role;
grant select, insert, update on table public.bluesky_sample_work_registry to service_role;

create policy "service role manages bluesky sample registry"
  on public.bluesky_sample_work_registry
  for all
  to service_role
  using (true)
  with check (true);
