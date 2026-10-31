alter table public.fanza_amateur_affiliate_clicks
  drop constraint if exists fanza_amateur_affiliate_clicks_affiliate_id_check;

alter table public.fanza_amateur_affiliate_clicks
  add constraint fanza_amateur_affiliate_clicks_affiliate_id_check
  check (affiliate_id in ('koichi1928-991', 'koichi1928-026'));
