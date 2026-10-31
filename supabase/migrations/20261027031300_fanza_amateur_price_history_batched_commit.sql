create or replace function public.commit_fanza_amateur_daily_price_history_batch(
  p_run_id uuid,
  p_after_content_id text default null,
  p_batch_size integer default 1000
)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_expected_item_count integer;
  v_saved_item_count integer;
  v_content_ids text[];
  v_batch_item_count integer;
  v_next_cursor text;
  v_written_count integer;
begin
  if p_batch_size < 1 or p_batch_size > 2000 then
    raise exception '価格履歴バッチサイズが範囲外です';
  end if;

  select expected_item_count
  into v_expected_item_count
  from public.fanza_amateur_api_catalog_runs
  where id = p_run_id
    and run_type = 'weekly_full'
    and status = 'running';

  if not found then
    raise exception '価格履歴は実行中の全件補完runからのみ保存できます';
  end if;

  if p_after_content_id is null then
    select count(*)
    into v_saved_item_count
    from public.fanza_amateur_api_catalog_items
    where run_id = p_run_id;

    if v_expected_item_count is null or v_saved_item_count <> v_expected_item_count then
      raise exception '価格履歴を保存できません: 取得件数が未検証です (expected %, saved %)',
        v_expected_item_count, v_saved_item_count;
    end if;
  end if;

  select array_agg(page.content_id order by page.content_id), count(*)::integer
  into v_content_ids, v_batch_item_count
  from (
    select item.content_id
    from public.fanza_amateur_api_catalog_items as item
    where item.run_id = p_run_id
      and (p_after_content_id is null or item.content_id > p_after_content_id)
    order by item.content_id
    limit p_batch_size
  ) as page;

  if v_batch_item_count = 0 then
    return jsonb_build_object(
      'next_cursor', p_after_content_id,
      'done', true,
      'batch_item_count', 0,
      'written_count', 0
    );
  end if;

  v_next_cursor := v_content_ids[v_batch_item_count];

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
    item.content_id,
    item.fetched_at,
    'summary',
    nullif(btrim(item.raw_item #>> '{prices,price}'), ''),
    nullif(btrim(item.raw_item #>> '{prices,list_price}'), ''),
    coalesce(item.raw_item -> 'prices', '{}'::jsonb)
  from public.fanza_amateur_api_catalog_items as item
  where item.run_id = p_run_id
    and item.content_id = any(v_content_ids)
    and jsonb_typeof(item.raw_item -> 'prices') = 'object'
    and (
      nullif(btrim(item.raw_item #>> '{prices,price}'), '') is not null
      or nullif(btrim(item.raw_item #>> '{prices,list_price}'), '') is not null
    )
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

  return jsonb_build_object(
    'next_cursor', v_next_cursor,
    'done', v_batch_item_count < p_batch_size,
    'batch_item_count', v_batch_item_count,
    'written_count', v_written_count
  );
end;
$$;

revoke all on function public.commit_fanza_amateur_daily_price_history_batch(uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.commit_fanza_amateur_daily_price_history_batch(uuid, text, integer)
  to service_role;

create or replace function public.commit_fanza_amateur_daily_price_history(p_run_id uuid)
returns integer
language plpgsql
set search_path = public, pg_temp
set statement_timeout = '120s'
as $$
declare
  v_cursor text := null;
  v_result jsonb;
  v_done boolean := false;
  v_total_written integer := 0;
begin
  while not v_done loop
    v_result := public.commit_fanza_amateur_daily_price_history_batch(p_run_id, v_cursor, 1000);
    v_cursor := v_result ->> 'next_cursor';
    v_done := coalesce((v_result ->> 'done')::boolean, false);
    v_total_written := v_total_written + coalesce((v_result ->> 'written_count')::integer, 0);
  end loop;

  return v_total_written;
end;
$$;

revoke all on function public.commit_fanza_amateur_daily_price_history(uuid)
  from public, anon, authenticated;
grant execute on function public.commit_fanza_amateur_daily_price_history(uuid)
  to service_role;
