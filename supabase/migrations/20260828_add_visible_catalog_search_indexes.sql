create index if not exists works_actress_visible_trgm_idx
  on public.works using gin (actress extensions.gin_trgm_ops)
  where coalesce(stage, '') <> 'DISCONTINUED';

create index if not exists works_genre_visible_trgm_idx
  on public.works using gin (genre extensions.gin_trgm_ops)
  where coalesce(stage, '') <> 'DISCONTINUED';
