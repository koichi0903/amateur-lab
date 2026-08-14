-- Keep discontinued rows and history for administration, but hide them from
-- the public clients used by pages, search and sitemap.
drop policy if exists "public read works" on public.works;

create policy "public read works"
  on public.works
  for select
  to anon, authenticated
  using (coalesce(stage, '') <> 'DISCONTINUED');
