alter table public.x_media_assets
  add column if not exists trim_start_seconds numeric not null default 0,
  add column if not exists trim_reviewed_at timestamptz,
  add column if not exists trim_reviewed_by text,
  add column if not exists trim_review_source text,
  add column if not exists trim_modify_confirmed boolean not null default false,
  add column if not exists trim_note text not null default '';

alter table public.x_media_assets
  drop constraint if exists x_media_assets_trim_start_seconds_check;

alter table public.x_media_assets
  add constraint x_media_assets_trim_start_seconds_check
  check (trim_start_seconds >= 0);

create index if not exists x_media_assets_trim_review_idx
  on public.x_media_assets (account_handle, trim_start_seconds, trim_reviewed_at desc)
  where media_type in ('video','sample_movie');
