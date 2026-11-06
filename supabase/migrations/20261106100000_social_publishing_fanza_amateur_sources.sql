begin;

alter table public.social_publishing_jobs
  add column if not exists source_catalog_content_id text;

do $$
declare
  existing_check record;
  definition text;
begin
  for existing_check in
    select conname, pg_get_constraintdef(oid) as constraint_definition
    from pg_constraint
    where conrelid = 'public.social_publishing_jobs'::regclass
      and contype = 'c'
  loop
    definition := lower(existing_check.constraint_definition);
    if definition like '%source_sample_url_hash%'
      and definition like '%trim_start_seconds%' then
      execute format('alter table public.social_publishing_jobs drop constraint %I', existing_check.conname);
    elsif definition like '%source_work_id%'
      and definition like '%source_usage_attested%'
      and definition like '%scheduled%'
      and definition not like '%source_sample_url_hash%' then
      execute format('alter table public.social_publishing_jobs drop constraint %I', existing_check.conname);
    end if;
  end loop;
end;
$$;

alter table public.social_publishing_jobs
  add constraint social_publishing_jobs_source_metadata_check check (
    (
      source_work_id is null
      and source_catalog_content_id is null
      and source_sample_url_hash is null
      and source_sample_host is null
      and source_maker is null
      and not source_usage_attested
      and source_usage_checked_at is null
      and trim_start_seconds is null
      and trim_end_seconds is null
    )
    or (
      source_work_id is not null
      and source_work_id > 0
      and source_catalog_content_id is null
      and source_sample_url_hash is not null
      and source_sample_url_hash ~ '^[a-f0-9]{64}$'
      and source_sample_host is not null
      and source_maker is not null
      and length(btrim(source_maker)) > 0
      and trim_start_seconds is not null
      and trim_end_seconds is not null
      and trim_start_seconds >= 0
      and trim_end_seconds > trim_start_seconds
      and trim_end_seconds - trim_start_seconds <= 60
    )
    or (
      source_work_id is null
      and source_catalog_content_id is not null
      and length(btrim(source_catalog_content_id)) between 1 and 120
      and source_sample_url_hash is not null
      and source_sample_url_hash ~ '^[a-f0-9]{64}$'
      and source_sample_host is not null
      and source_maker is not null
      and length(btrim(source_maker)) > 0
      and trim_start_seconds is not null
      and trim_end_seconds is not null
      and trim_start_seconds >= 0
      and trim_end_seconds > trim_start_seconds
      and trim_end_seconds - trim_start_seconds <= 60
    )
  );

alter table public.social_publishing_jobs
  add constraint social_publishing_jobs_source_usage_gate_check check (
    status not in ('scheduled', 'publishing', 'published')
    or (source_work_id is null and source_catalog_content_id is null)
    or (source_usage_attested and source_usage_checked_at is not null)
  );

create unique index if not exists social_publishing_jobs_channel_source_catalog_content_uidx
  on public.social_publishing_jobs (channel_id, source_catalog_content_id)
  where source_catalog_content_id is not null;

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
    or new.source_catalog_content_id is distinct from old.source_catalog_content_id
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

drop trigger if exists social_publishing_invalidate_review_trigger on public.social_publishing_jobs;
create trigger social_publishing_invalidate_review_trigger
  before update of channel_id, content_kind, caption, youtube_privacy_status, tiktok_privacy_level, media_storage_key, media_sha256, source_work_id,
    source_catalog_content_id, source_sample_url_hash, source_sample_host, source_maker, trim_start_seconds, trim_end_seconds, scheduled_at
  on public.social_publishing_jobs
  for each row execute function public.social_publishing_invalidate_review();

commit;
