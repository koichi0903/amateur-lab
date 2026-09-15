alter table public.x_post_logs
  drop constraint if exists x_post_logs_category_check;

alter table public.x_post_logs
  add constraint x_post_logs_category_check
  check (category = any (array[
    'sales'::text,
    'deal'::text,
    'score'::text,
    'new'::text,
    'hidden_gem'::text,
    'today_buy'::text,
    'today_discovery'::text,
    'actress_best'::text,
    'genre_best'::text,
    'maker_best'::text,
    'series_best'::text
  ]));
