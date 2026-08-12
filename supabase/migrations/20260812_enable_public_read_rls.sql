-- Public catalog data is readable by the site, but only server-side service-role
-- code may mutate it. Run after deploying the matching application changes.

alter table public.works enable row level security;
alter table public.work_prices enable row level security;
alter table public.price_history enable row level security;
alter table public.work_sample_images enable row level security;
alter table public.insights enable row level security;
alter table public.actress_rankings enable row level security;
alter table public.genre_rankings enable row level security;
alter table public.maker_rankings enable row level security;
alter table public.series_rankings enable row level security;
alter table public.site_statistics enable row level security;
alter table public.jobs enable row level security;

drop policy if exists "public read works" on public.works;
create policy "public read works"
  on public.works for select to anon, authenticated using (true);

drop policy if exists "public read work prices" on public.work_prices;
create policy "public read work prices"
  on public.work_prices for select to anon, authenticated using (true);

drop policy if exists "public read price history" on public.price_history;
create policy "public read price history"
  on public.price_history for select to anon, authenticated using (true);

drop policy if exists "public read work sample images" on public.work_sample_images;
create policy "public read work sample images"
  on public.work_sample_images for select to anon, authenticated using (true);

drop policy if exists "public read insights" on public.insights;
create policy "public read insights"
  on public.insights for select to anon, authenticated using (true);

drop policy if exists "public read actress rankings" on public.actress_rankings;
create policy "public read actress rankings"
  on public.actress_rankings for select to anon, authenticated using (true);

drop policy if exists "public read genre rankings" on public.genre_rankings;
create policy "public read genre rankings"
  on public.genre_rankings for select to anon, authenticated using (true);

drop policy if exists "public read maker rankings" on public.maker_rankings;
create policy "public read maker rankings"
  on public.maker_rankings for select to anon, authenticated using (true);

drop policy if exists "public read series rankings" on public.series_rankings;
create policy "public read series rankings"
  on public.series_rankings for select to anon, authenticated using (true);

drop policy if exists "public read site statistics" on public.site_statistics;
create policy "public read site statistics"
  on public.site_statistics for select to anon, authenticated using (true);

-- Defense in depth: even if RLS is disabled accidentally later, public roles
-- still cannot modify catalog or operational tables.
revoke insert, update, delete, truncate, references, trigger
  on table public.works, public.work_prices, public.price_history,
  public.work_sample_images, public.insights, public.actress_rankings,
  public.genre_rankings, public.maker_rankings, public.series_rankings,
  public.site_statistics, public.jobs
  from anon, authenticated;

