alter table public.myfans_quote_refresh_job_items
  add column if not exists request_type text not null default 'quote_scan',
  add column if not exists result_code text,
  add column if not exists http_status integer,
  add column if not exists diagnostics jsonb not null default '{}'::jsonb,
  add column if not exists started_at timestamptz,
  add column if not exists finished_at timestamptz;

create index if not exists myfans_quote_refresh_job_items_result_code_idx
  on public.myfans_quote_refresh_job_items (job_id, result_code, finished_at desc);

comment on column public.myfans_quote_refresh_job_items.diagnostics is
  'Safe, redacted terminal diagnostics only; never cookies, tokens, or captured post bodies.';
