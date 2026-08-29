alter table public.affiliate_clicks
  add column if not exists x_post_key text;

create index if not exists affiliate_clicks_x_post_key_clicked_at_idx
  on public.affiliate_clicks (x_post_key, clicked_at desc);
