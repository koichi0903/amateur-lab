alter table public.works
  add column if not exists sample_movie_checked_at timestamptz;

create index if not exists works_sample_movie_check_queue_idx
  on public.works (sample_movie_checked_at, product_id)
  where sample_movie_url is null and stage <> 'DISCONTINUED';
