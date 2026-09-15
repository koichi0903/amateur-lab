alter table public.x_media_assets
  add column if not exists source_domain text,
  add column if not exists source_kind text not null default 'unknown_external',
  add column if not exists mime_type text,
  add column if not exists content_length bigint,
  add column if not exists fetch_status text not null default 'unknown',
  add column if not exists fetch_status_code integer,
  add column if not exists last_checked_at timestamptz,
  add column if not exists rights_basis_type text,
  add column if not exists rights_basis_url text,
  add column if not exists evidence_ref text,
  add column if not exists rights_basis_note text not null default '',
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by text,
  add column if not exists review_source text,
  add column if not exists can_modify boolean not null default false,
  add column if not exists commercial_use_allowed boolean not null default false,
  add column if not exists media_quality text not null default 'unreviewed',
  add column if not exists manual_tags text[] not null default '{}'::text[];

update public.x_media_assets
set rights_status = case rights_status
  when 'unchecked' then 'unknown'
  when 'rejected' then 'blocked'
  when 'expired' then 'blocked'
  else rights_status
end
where rights_status in ('unchecked','rejected','expired');

alter table public.x_media_assets
  drop constraint if exists x_media_assets_rights_status_check;

alter table public.x_media_assets
  add constraint x_media_assets_rights_status_check
  check (rights_status in ('unknown','review','allowed','blocked'));

alter table public.x_media_assets
  drop constraint if exists x_media_assets_fetch_status_check;

alter table public.x_media_assets
  add constraint x_media_assets_fetch_status_check
  check (fetch_status in ('ok','dead','redirect','forbidden','unknown','unchecked'));

alter table public.x_media_assets
  drop constraint if exists x_media_assets_rights_basis_type_check;

alter table public.x_media_assets
  add constraint x_media_assets_rights_basis_type_check
  check (rights_basis_type is null or rights_basis_type in ('explicit_permission','official_policy','creator_permission','license','prohibited','insufficient_evidence'));

alter table public.x_media_assets
  drop constraint if exists x_media_assets_media_quality_check;

alter table public.x_media_assets
  add constraint x_media_assets_media_quality_check
  check (media_quality in ('unreviewed','strong','normal','weak'));

create unique index if not exists x_media_assets_account_work_source_idx
  on public.x_media_assets (account_handle, work_id, source_url);

create index if not exists x_media_assets_review_queue_idx
  on public.x_media_assets (account_handle, rights_status, fetch_status, updated_at desc)
  where media_type in ('video','sample_movie');

create index if not exists x_media_assets_source_domain_idx
  on public.x_media_assets (account_handle, source_domain, source_kind);
