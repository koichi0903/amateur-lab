create extension if not exists pg_trgm with schema extensions;

create index if not exists works_actress_trgm_idx
  on public.works using gin (actress extensions.gin_trgm_ops);

create index if not exists works_genre_trgm_idx
  on public.works using gin (genre extensions.gin_trgm_ops);

create index if not exists works_maker_score_idx
  on public.works (maker, score desc nulls last);

create index if not exists works_series_score_idx
  on public.works (series, score desc nulls last);
