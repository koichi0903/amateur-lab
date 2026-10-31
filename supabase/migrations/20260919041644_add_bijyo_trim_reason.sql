alter table public.bijyo_reserved_post_jobs
  add column if not exists trim_reason text not null default 'existing_analysis';
