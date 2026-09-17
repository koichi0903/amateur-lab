alter table public.x_media_assets
  add column if not exists visual_video_facts jsonb,
  add column if not exists video_analysis_version text,
  add column if not exists video_analysis_source_fingerprint text,
  add column if not exists video_analyzed_at timestamptz,
  add column if not exists video_raw_metrics jsonb,
  add column if not exists video_analysis_diagnostics jsonb not null default '[]'::jsonb;

create index if not exists x_media_assets_video_analysis_idx
  on public.x_media_assets (account_handle, video_analysis_version, video_analyzed_at desc)
  where media_type in ('video', 'sample_movie');
