-- Shared server-side queue for scheduled social publishing.
-- OAuth tokens are encrypted by the application before being stored here.
-- No anon/authenticated access is granted; only trusted server-side service_role code may use these tables.

-- Assets stay private in Supabase Storage. The app verifies this exact bucket
-- before exposing preview URLs or allowing any channel to be enabled.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('social-publishing-media', 'social-publishing-media', false, 67108864, array['video/mp4']::text[])
on conflict (id) do nothing;

create table if not exists public.social_publishing_channels (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('youtube_shorts', 'instagram_reels', 'threads', 'tiktok')),
  provider_account_id text not null,
  account_label text not null,
  access_token_ciphertext text not null,
  refresh_token_ciphertext text,
  token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scopes text[] not null default '{}',
  enabled boolean not null default false,
  last_error_code text,
  last_error_at timestamptz,
  authorized_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, provider_account_id)
);

create table if not exists public.social_publishing_jobs (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.social_publishing_channels(id) on delete restrict,
  idempotency_key text not null unique,
  content_kind text not null check (content_kind in ('video', 'image', 'text')),
  caption text not null default '',
  youtube_privacy_status text check (youtube_privacy_status is null or youtube_privacy_status in ('public', 'unlisted', 'private')),
  tiktok_privacy_level text check (tiktok_privacy_level is null or tiktok_privacy_level in ('PUBLIC_TO_EVERYONE', 'FOLLOWER_OF_CREATOR', 'MUTUAL_FOLLOW_FRIENDS', 'SELF_ONLY')),
  media_storage_key text,
  media_sha256 text,
  source_work_id bigint,
  source_sample_url_hash text check (source_sample_url_hash is null or source_sample_url_hash ~ '^[a-f0-9]{64}$'),
  source_sample_host text,
  source_maker text,
  source_usage_attested boolean not null default false,
  source_usage_checked_at timestamptz,
  trim_start_seconds numeric,
  trim_end_seconds numeric,
  scheduled_at timestamptz not null,
  status text not null default 'awaiting_user_review'
    check (status in ('draft', 'awaiting_user_review', 'scheduled', 'publishing', 'published', 'failed', 'paused', 'rejected')),
  content_revision integer not null default 1 check (content_revision > 0),
  review_status text not null default 'pending'
    check (review_status in ('pending', 'approved', 'rejected')),
  review_attested boolean not null default false,
  approved_revision integer,
  reviewed_at timestamptz,
  attempt_count smallint not null default 0 check (attempt_count >= 0),
  max_attempts smallint not null default 3 check (max_attempts between 1 and 5),
  provider_post_id text,
  provider_request_id text,
  published_at timestamptz,
  last_error_code text,
  last_error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (content_kind = 'text' and media_storage_key is null)
    or (content_kind in ('video', 'image') and media_storage_key is not null and media_sha256 ~ '^[a-f0-9]{64}$')
  ),
  check (
    (source_work_id is null and source_sample_url_hash is null and source_sample_host is null and source_maker is null and not source_usage_attested and source_usage_checked_at is null and trim_start_seconds is null and trim_end_seconds is null)
    or (source_work_id > 0 and source_sample_url_hash is not null and source_sample_url_hash ~ '^[a-f0-9]{64}$' and source_sample_host is not null and source_maker is not null and length(btrim(source_maker)) > 0 and trim_start_seconds is not null and trim_end_seconds is not null and trim_start_seconds >= 0 and trim_end_seconds > trim_start_seconds and trim_end_seconds - trim_start_seconds <= 60)
  ),
  check (
    status not in ('scheduled', 'publishing', 'published')
    or (review_status = 'approved' and review_attested and approved_revision = content_revision and reviewed_at is not null)
  ),
  check (
    status not in ('scheduled', 'publishing', 'published')
    or source_work_id is null
    or (source_usage_attested and source_usage_checked_at is not null)
  )
);

create or replace function public.social_publishing_invalidate_review()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.channel_id is distinct from old.channel_id
    or new.content_kind is distinct from old.content_kind
    or new.caption is distinct from old.caption
    or new.youtube_privacy_status is distinct from old.youtube_privacy_status
    or new.tiktok_privacy_level is distinct from old.tiktok_privacy_level
    or new.media_storage_key is distinct from old.media_storage_key
    or new.media_sha256 is distinct from old.media_sha256
    or new.source_work_id is distinct from old.source_work_id
    or new.source_sample_url_hash is distinct from old.source_sample_url_hash
    or new.source_sample_host is distinct from old.source_sample_host
    or new.source_maker is distinct from old.source_maker
    or new.trim_start_seconds is distinct from old.trim_start_seconds
    or new.trim_end_seconds is distinct from old.trim_end_seconds
    or new.scheduled_at is distinct from old.scheduled_at then
    if old.status in ('publishing', 'published', 'failed', 'rejected') then
      raise exception 'This social publishing job is terminal and cannot be edited.';
    end if;
    new.content_revision := old.content_revision + 1;
    new.review_status := 'pending';
    new.review_attested := false;
    new.source_usage_attested := false;
    new.source_usage_checked_at := null;
    new.approved_revision := null;
    new.reviewed_at := null;
    new.status := 'awaiting_user_review';
  end if;
  return new;
end;
$$;

revoke all on function public.social_publishing_invalidate_review() from public, anon, authenticated;

create trigger social_publishing_invalidate_review_trigger
  before update of channel_id, content_kind, caption, youtube_privacy_status, tiktok_privacy_level, media_storage_key, media_sha256, source_work_id,
    source_sample_url_hash, source_sample_host, source_maker, trim_start_seconds, trim_end_seconds, scheduled_at
  on public.social_publishing_jobs
  for each row execute function public.social_publishing_invalidate_review();

create index if not exists social_publishing_jobs_due_idx
  on public.social_publishing_jobs (scheduled_at, created_at)
  where status = 'scheduled';

create index if not exists social_publishing_jobs_channel_status_idx
  on public.social_publishing_jobs (channel_id, status, scheduled_at desc);

create unique index if not exists social_publishing_jobs_channel_source_work_uidx
  on public.social_publishing_jobs (channel_id, source_work_id)
  where source_work_id is not null;

alter table public.social_publishing_channels enable row level security;
alter table public.social_publishing_jobs enable row level security;

revoke all on table public.social_publishing_channels from anon, authenticated;
revoke all on table public.social_publishing_jobs from anon, authenticated;
grant all on table public.social_publishing_channels to service_role;
grant all on table public.social_publishing_jobs to service_role;
