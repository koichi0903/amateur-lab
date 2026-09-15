-- Keep sales period separate from the human-readable sales format.
-- This prevents 7-day and unlimited plans from sharing one price series.
alter table public.work_prices
  add column if not exists period text;

alter table public.price_history
  add column if not exists period text;

alter table public.work_prices
  add column if not exists price_kind text not null default 'regular';

alter table public.price_history
  add column if not exists price_kind text not null default 'regular';

alter table public.work_prices
  drop constraint if exists work_prices_product_id_display_name_key;

-- Older Playwright rows encoded the period in display_name when the same
-- format appeared more than once. Move those suffixes into the new column.
update public.work_prices
set
  period = coalesce(period, substring(display_name from '（(7日間|無期限|期間不明)）')),
  display_name = regexp_replace(display_name, '（(7日間|無期限|期間不明)）$', '')
where display_name ~ '（(7日間|無期限|期間不明)）$';

update public.price_history
set
  period = coalesce(period, substring(display_name from '（(7日間|無期限|期間不明)）')),
  display_name = regexp_replace(display_name, '（(7日間|無期限|期間不明)）$', '')
where display_name ~ '（(7日間|無期限|期間不明)）$';

update public.work_prices
set price_kind = case
  when sale_price is not null and normal_price is not null and sale_price > 0 and sale_price < normal_price then 'sale'
  else 'regular'
end;

update public.price_history
set price_kind = case
  when sale_price is not null and normal_price is not null and sale_price > 0 and sale_price < normal_price then 'sale'
  else 'regular'
end;

create index if not exists work_prices_product_format_period_idx
  on public.work_prices (product_id, display_name, period);

create index if not exists price_history_product_format_period_changed_idx
  on public.price_history (product_id, display_name, period, changed_at desc);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'work_prices_product_id_display_name_period_key'
  ) then
    alter table public.work_prices
      add constraint work_prices_product_id_display_name_period_key
      unique (product_id, display_name, period);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'work_prices_price_kind_check'
  ) then
    alter table public.work_prices
      add constraint work_prices_price_kind_check
      check (price_kind in ('regular', 'sale'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'price_history_price_kind_check'
  ) then
    alter table public.price_history
      add constraint price_history_price_kind_check
      check (price_kind in ('regular', 'sale'));
  end if;
end $$;
