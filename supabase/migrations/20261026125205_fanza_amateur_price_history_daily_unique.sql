alter table public.fanza_amateur_price_history
  add column if not exists observed_date_jst date
  generated always as ((observed_at at time zone 'Asia/Tokyo')::date) stored;

create unique index if not exists fanza_amateur_price_history_one_daily_row
  on public.fanza_amateur_price_history (content_id, observed_date_jst, price_type);
