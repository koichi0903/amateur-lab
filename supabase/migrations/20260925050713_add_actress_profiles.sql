create table if not exists public.actress_profiles (
  dmm_actress_id text primary key,
  name text not null,
  ruby text,
  birthday date,
  height_cm integer,
  bust_cm integer,
  waist_cm integer,
  hip_cm integer,
  cup text,
  blood_type text,
  hobby text,
  prefectures text,
  image_url_small text,
  image_url_large text,
  fanza_digital_url text,
  updated_at timestamptz not null default now()
);

create index if not exists actress_profiles_name_idx on public.actress_profiles (name);
create index if not exists actress_profiles_birthday_idx on public.actress_profiles (birthday);

alter table public.actress_profiles enable row level security;

drop policy if exists "public read actress profiles" on public.actress_profiles;
create policy "public read actress profiles"
  on public.actress_profiles for select to anon, authenticated using (true);

grant select on public.actress_profiles to anon, authenticated;
