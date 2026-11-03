create or replace function public.commit_fanza_amateur_daily_price_history(p_run_id uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_expected_item_count integer;
  v_saved_item_count integer;
  v_written_count integer;
begin
  select run.expected_item_count
  into v_expected_item_count
  from public.fanza_amateur_api_catalog_runs as run
  where run.id = p_run_id
    and run.run_type = 'weekly_full'
    and run.status = 'running';

  if not found or v_expected_item_count is null then
    raise exception '価格履歴は実行中の全件補完runからのみ保存できます';
  end if;

  select count(*)
  into v_saved_item_count
  from public.fanza_amateur_api_catalog_items as item
  where item.run_id = p_run_id;

  if v_saved_item_count <> v_expected_item_count then
    raise exception '価格履歴を保存できません: 取得件数が未検証です (expected %, saved %)',
      v_expected_item_count, v_saved_item_count;
  end if;

  with staged as (
    select item.content_id, item.fetched_at, item.raw_item -> 'prices' as prices
    from public.fanza_amateur_api_catalog_items as item
    where item.run_id = p_run_id
      and jsonb_typeof(item.raw_item -> 'prices') = 'object'
  ),
  delivery_rows as (
    select
      staged.content_id,
      staged.fetched_at,
      delivery.value as price_data,
      coalesce(nullif(btrim(delivery.value ->> 'type'), ''), 'unknown_' || delivery.ordinality::text) as delivery_type,
      nullif(btrim(delivery.value ->> 'price'), '') as price,
      nullif(btrim(delivery.value ->> 'list_price'), '') as list_price,
      delivery.ordinality
    from staged
    cross join lateral jsonb_array_elements(
      case jsonb_typeof(staged.prices #> '{deliveries,delivery}')
        when 'array' then staged.prices #> '{deliveries,delivery}'
        when 'object' then jsonb_build_array(staged.prices #> '{deliveries,delivery}')
        else '[]'::jsonb
      end
    ) with ordinality as delivery(value, ordinality)
  ),
  typed_delivery_rows as (
    select
      delivery_rows.*,
      row_number() over (partition by content_id, delivery_type order by ordinality) as type_occurrence
    from delivery_rows
  ),
  history_rows as (
    select
      staged.content_id,
      staged.fetched_at as observed_at,
      'summary'::text as price_type,
      nullif(btrim(staged.prices ->> 'price'), '') as price,
      nullif(btrim(staged.prices ->> 'list_price'), '') as list_price,
      staged.prices as price_data
    from staged
    union all
    select
      typed_delivery_rows.content_id,
      typed_delivery_rows.fetched_at,
      case when typed_delivery_rows.type_occurrence = 1 then typed_delivery_rows.delivery_type
        else typed_delivery_rows.delivery_type || '#' || typed_delivery_rows.type_occurrence::text
      end,
      typed_delivery_rows.price,
      typed_delivery_rows.list_price,
      typed_delivery_rows.price_data
    from typed_delivery_rows
  )
  insert into public.fanza_amateur_price_history (
    source_run_id,
    content_id,
    observed_at,
    price_type,
    price,
    list_price,
    price_data
  )
  select
    p_run_id,
    history_rows.content_id,
    history_rows.observed_at,
    history_rows.price_type,
    history_rows.price,
    history_rows.list_price,
    history_rows.price_data
  from history_rows
  where history_rows.price is not null or history_rows.list_price is not null
  on conflict (content_id, observed_date_jst, price_type)
  do update set
    source_run_id = excluded.source_run_id,
    observed_at = excluded.observed_at,
    price = excluded.price,
    list_price = excluded.list_price,
    price_data = excluded.price_data
  where public.fanza_amateur_price_history.price is distinct from excluded.price
     or public.fanza_amateur_price_history.list_price is distinct from excluded.list_price;

  get diagnostics v_written_count = row_count;
  return v_written_count;
end;
$$;

revoke all on function public.commit_fanza_amateur_daily_price_history(uuid)
  from public, anon, authenticated;
grant execute on function public.commit_fanza_amateur_daily_price_history(uuid)
  to service_role;
