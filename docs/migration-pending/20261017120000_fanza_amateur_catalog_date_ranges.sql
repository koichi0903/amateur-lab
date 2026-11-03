alter table public.fanza_amateur_api_catalog_runs
  add column if not exists pending_ranges jsonb not null default '[]'::jsonb
    check (jsonb_typeof(pending_ranges) = 'array'),
  add column if not exists current_range jsonb
    check (current_range is null or jsonb_typeof(current_range) = 'object'),
  add column if not exists completed_range_count integer not null default 0
    check (completed_range_count >= 0);

update public.fanza_amateur_api_catalog_runs
set status = 'limit_reached',
    last_error = '旧50,000件スキャナーの途中状態です。保存済み作品は保持しました。日付分割方式で新しい全件取得を開始してください。',
    updated_at = now(),
    completed_at = now()
where status = 'running'
  and pending_ranges = '[]'::jsonb
  and current_range is null;
