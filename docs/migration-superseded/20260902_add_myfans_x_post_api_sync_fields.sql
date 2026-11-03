alter table public.myfans_x_posts
  add column if not exists x_post_id text not null default '',
  add column if not exists metrics_sync_error text not null default '';

create unique index if not exists myfans_x_posts_x_post_id_idx
  on public.myfans_x_posts (x_post_id)
  where x_post_id <> '';
