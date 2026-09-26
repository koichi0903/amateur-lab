-- MyFans multi-account boundary.
-- myfans_approved_media is the existing account registry.  Its id is the
-- stable account identity; media_name remains a display label only.
-- Supply entities (creators/products/quote candidates with NULL media id)
-- remain shareable.  Operational history and attribution are account scoped.

alter table public.myfans_approved_media
  add column if not exists account_key text;

update public.myfans_approved_media
set account_key = lower(regexp_replace(media_name, '^@', ''))
where nullif(trim(account_key), '') is null;

alter table public.myfans_approved_media
  alter column account_key set not null;

create unique index if not exists myfans_approved_media_account_key_idx
  on public.myfans_approved_media (account_key);

insert into public.myfans_approved_media
  (media_name, media_url, affiliate_media_id, status, notes, account_key)
values
  ('@fansmy230', 'https://x.com/fansmy230', '', 'active',
   '新規MyFans運用アカウント。既存@lumi_reviwの履歴・学習はコピーしない。', 'fansmy230')
on conflict (account_key) do nothing;

-- Existing rows already carry approved_media_id where they are operational.
-- These columns make attribution explicit for revenue events and raw metrics.
alter table public.myfans_affiliate_clicks
  add column if not exists approved_media_id bigint references public.myfans_approved_media(id) on delete restrict;
alter table public.myfans_conversions
  add column if not exists approved_media_id bigint references public.myfans_approved_media(id) on delete restrict;
alter table public.myfans_daily_metrics
  add column if not exists approved_media_id bigint references public.myfans_approved_media(id) on delete restrict;
alter table public.myfans_revenue_imports
  add column if not exists approved_media_id bigint references public.myfans_approved_media(id) on delete restrict;
alter table public.myfans_audit_logs
  add column if not exists approved_media_id bigint references public.myfans_approved_media(id) on delete restrict;

-- Preserve existing attribution without fabricating cross-account data.
update public.myfans_affiliate_clicks c
set approved_media_id = coalesce(p.approved_media_id, pr.approved_media_id)
from public.myfans_x_posts p
full join public.myfans_products pr on pr.id = c.product_id
where c.approved_media_id is null
  and (p.id = c.x_post_id or pr.id = c.product_id);

update public.myfans_conversions c
set approved_media_id = coalesce(p.approved_media_id, pr.approved_media_id)
from public.myfans_x_posts p
full join public.myfans_products pr on pr.id = c.product_id
where c.approved_media_id is null
  and (p.id = c.x_post_id or pr.id = c.product_id);

update public.myfans_daily_metrics d
set approved_media_id = coalesce(p.approved_media_id, pr.approved_media_id)
from public.myfans_x_posts p
full join public.myfans_products pr on pr.id = d.product_id
where d.approved_media_id is null
  and (p.id = d.x_post_id or pr.id = d.product_id);

-- Existing operational snapshots were created before the account switch and
-- therefore had no media id.  They belong to the only historically active
-- account, lumi_reviw.  Do not apply this backfill to supply tables.
do $$
declare v_lumi_id bigint;
begin
  select id into v_lumi_id from public.myfans_approved_media where account_key = 'lumi_reviw';
  if v_lumi_id is not null then
    update public.myfans_daily_plans set approved_media_id = v_lumi_id where approved_media_id is null;
    update public.myfans_attention_candidates set approved_media_id = v_lumi_id where approved_media_id is null;
    update public.myfans_outbound_tasks set approved_media_id = v_lumi_id where approved_media_id is null;
    update public.myfans_quote_refresh_jobs set approved_media_id = v_lumi_id where approved_media_id is null;
    update public.myfans_visual_verification_jobs set approved_media_id = v_lumi_id where approved_media_id is null;
    update public.myfans_x_posts set approved_media_id = v_lumi_id where approved_media_id is null;
  end if;
end;
$$;

-- Revenue import files and conversion row keys are also account-local.
update public.myfans_conversions c
set row_key = coalesce(m.account_key, 'shared') || ':' || c.row_key
from public.myfans_approved_media m
where c.approved_media_id = m.id and position(':' in c.row_key) = 0;
alter table public.myfans_conversions drop constraint if exists myfans_conversions_row_key_key;
create unique index if not exists myfans_conversions_account_row_key_idx
  on public.myfans_conversions (approved_media_id, row_key);
drop index if exists myfans_revenue_imports_month_file_idx;
create unique index if not exists myfans_revenue_imports_account_month_file_idx
  on public.myfans_revenue_imports (approved_media_id, report_month, source_file);

update public.myfans_revenue_imports
set approved_media_id = m.id
from public.myfans_approved_media m
where approved_media_id is null and m.account_key = 'lumi_reviw';

create index if not exists myfans_clicks_account_date_idx
  on public.myfans_affiliate_clicks (approved_media_id, clicked_at desc);
create index if not exists myfans_conversions_account_date_idx
  on public.myfans_conversions (approved_media_id, occurred_at desc);
create index if not exists myfans_daily_metrics_account_date_idx
  on public.myfans_daily_metrics (approved_media_id, metric_date desc);
create index if not exists myfans_revenue_imports_account_month_idx
  on public.myfans_revenue_imports (approved_media_id, report_month desc);
create index if not exists myfans_audit_logs_account_date_idx
  on public.myfans_audit_logs (approved_media_id, created_at desc);

-- Permanent exclusion is account-local: the same source/product may be used
-- by another account.  NULL remains only for legacy rows until backfilled.
alter table public.myfans_permanent_candidate_exclusions
  add column if not exists approved_media_id bigint references public.myfans_approved_media(id) on delete restrict;

update public.myfans_permanent_candidate_exclusions e
set approved_media_id = p.approved_media_id
from public.myfans_x_posts p
where e.approved_media_id is null
  and (e.context->>'post_id') ~ '^[0-9]+$'
  and (e.context->>'post_id')::bigint = p.id
  and p.approved_media_id is not null;

drop index if exists myfans_permanent_candidate_exclusions_entity_idx;
create unique index if not exists myfans_permanent_candidate_exclusions_account_entity_idx
  on public.myfans_permanent_candidate_exclusions (coalesce(approved_media_id, 0), entity_type, entity_key);
create unique index if not exists myfans_permanent_candidate_exclusions_account_entity_columns_idx
  on public.myfans_permanent_candidate_exclusions (approved_media_id, entity_type, entity_key)
  where approved_media_id is not null;
create index if not exists myfans_permanent_candidate_exclusions_account_idx
  on public.myfans_permanent_candidate_exclusions (approved_media_id, created_at desc);

-- Idempotency is account-local.  Existing keys remain valid for lumi and can
-- be reused by fansmy230 without collision.
drop index if exists myfans_x_posts_idempotency_key_uidx;
create unique index if not exists myfans_x_posts_account_idempotency_key_uidx
  on public.myfans_x_posts (coalesce(approved_media_id, 0), idempotency_key)
  where idempotency_key is not null and idempotency_key <> '';

-- Rebind the service-role post writer to the account-local keys and
-- account-local permanent exclusions.  The old function used a global
-- idempotency lookup and a global exclusion conflict target.
create or replace function public.save_myfans_post(
  p_post jsonb,
  p_idempotency_key text,
  p_quote_x_url text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post_id bigint;
  v_account_id bigint := nullif(p_post->>'approved_media_id', '')::bigint;
  v_was_posted boolean := false;
  v_is_posted boolean := coalesce(p_post->>'status', '') = 'posted';
  v_source text := nullif(trim(coalesce(nullif(p_quote_x_url, ''), nullif(p_post->>'source_x_url', ''))), '');
begin
  if nullif(p_post->>'body', '') is null then raise exception 'MYFANS_POST_BODY_REQUIRED'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    coalesce(v_account_id::text, 'shared') || ':' ||
    coalesce(nullif(p_idempotency_key, ''), nullif(p_post->>'id', ''), p_post->>'body'), 0));

  if nullif(p_post->>'id', '') is not null then
    select id, status = 'posted' or posted_at is not null into v_post_id, v_was_posted
    from public.myfans_x_posts where id = (p_post->>'id')::bigint for update;
    if v_post_id is null then raise exception 'MYFANS_POST_NOT_FOUND'; end if;
  elsif nullif(p_idempotency_key, '') is not null then
    select id, status = 'posted' or posted_at is not null into v_post_id, v_was_posted
    from public.myfans_x_posts
    where idempotency_key = p_idempotency_key
      and coalesce(approved_media_id, 0) = coalesce(v_account_id, 0)
    for update;
  end if;

  if v_post_id is not null then
    update public.myfans_x_posts set
      product_id = case when p_post ? 'product_id' then nullif(p_post->>'product_id', '')::bigint else product_id end,
      post_type = coalesce(p_post->>'post_type', post_type), status = coalesce(p_post->>'status', status),
      body = p_post->>'body', self_reply = coalesce(p_post->>'self_reply', self_reply),
      source_x_url = coalesce(p_post->>'source_x_url', source_x_url), affiliate_url = coalesce(p_post->>'affiliate_url', affiliate_url),
      selection_reason = coalesce(p_post->>'selection_reason', selection_reason),
      scheduled_at = case when p_post ? 'scheduled_at' then (p_post->>'scheduled_at')::timestamptz else scheduled_at end,
      posted_at = case when p_post ? 'posted_at' then (p_post->>'posted_at')::timestamptz else posted_at end,
      x_post_url = coalesce(p_post->>'x_post_url', x_post_url), actual_posted_by = coalesce(p_post->>'actual_posted_by', actual_posted_by),
      approved_media_id = coalesce(v_account_id, approved_media_id), approved_media_name = coalesce(p_post->>'approved_media_name', approved_media_name),
      quote_x_url = coalesce(p_post->>'quote_x_url', quote_x_url),
      impressions = coalesce(nullif(p_post->>'impressions', '')::integer, impressions), likes_count = coalesce(nullif(p_post->>'likes_count', '')::integer, likes_count),
      reposts_count = coalesce(nullif(p_post->>'reposts_count', '')::integer, reposts_count), replies_count = coalesce(nullif(p_post->>'replies_count', '')::integer, replies_count), clicks = coalesce(nullif(p_post->>'clicks', '')::integer, clicks),
      updated_at = pg_catalog.now()
    where id = v_post_id;
  else
    insert into public.myfans_x_posts (
      product_id, post_type, status, body, self_reply, includes_pr, source_x_url, affiliate_url, selection_reason,
      scheduled_at, posted_at, x_post_url, actual_posted_by, approved_media_id, approved_media_name, quote_x_url,
      impressions, likes_count, reposts_count, replies_count, clicks, idempotency_key, created_at, updated_at
    ) values (
      nullif(p_post->>'product_id', '')::bigint, coalesce(p_post->>'post_type', 'discovery'), coalesce(p_post->>'status', 'draft'), p_post->>'body', coalesce(p_post->>'self_reply', ''),
      coalesce((p_post->>'includes_pr')::boolean, true), coalesce(p_post->>'source_x_url', ''), coalesce(p_post->>'affiliate_url', ''), coalesce(p_post->>'selection_reason', ''),
      (p_post->>'scheduled_at')::timestamptz, (p_post->>'posted_at')::timestamptz, coalesce(p_post->>'x_post_url', ''), coalesce(p_post->>'actual_posted_by', ''),
      v_account_id, coalesce(p_post->>'approved_media_name', ''), coalesce(p_post->>'quote_x_url', ''),
      coalesce(nullif(p_post->>'impressions', '')::integer, 0), coalesce(nullif(p_post->>'likes_count', '')::integer, 0), coalesce(nullif(p_post->>'reposts_count', '')::integer, 0),
      coalesce(nullif(p_post->>'replies_count', '')::integer, 0), coalesce(nullif(p_post->>'clicks', '')::integer, 0), nullif(p_idempotency_key, ''), pg_catalog.now(), pg_catalog.now()
    ) returning id into v_post_id;
  end if;

  if v_is_posted and not v_was_posted and v_source is not null then
  update public.myfans_quote_candidates set selected_for_today = true, last_used_at = pg_catalog.now(), cooldown_until = pg_catalog.now() + interval '30 days', use_count = use_count + 1
    where x_post_url = p_quote_x_url and v_account_id is not null and approved_media_id = v_account_id;
  end if;
  if v_is_posted then
    insert into public.myfans_permanent_candidate_exclusions (approved_media_id, entity_type, entity_key, product_id, reason, context)
    select v_account_id, 'product', 'product:' || product_id::text, product_id, 'posted', jsonb_build_object('recorded_from','myfans_x_posts','post_id',v_post_id)
    from public.myfans_x_posts where id = v_post_id and product_id is not null on conflict do nothing;
    insert into public.myfans_permanent_candidate_exclusions (approved_media_id, entity_type, entity_key, source_status_url, reason, context)
    select v_account_id, 'source', 'source:' || lower(trim(v_source)), v_source, 'posted', jsonb_build_object('recorded_from','myfans_x_posts','post_id',v_post_id)
    where v_source is not null and not exists (select 1 from public.myfans_x_posts where id = v_post_id and product_id is not null)
    on conflict do nothing;
  end if;
  return jsonb_build_object('post_id', v_post_id, 'incremented', v_is_posted and not v_was_posted);
end;
$$;

revoke all on function public.save_myfans_post(jsonb, text, text) from public, anon, authenticated;
grant execute on function public.save_myfans_post(jsonb, text, text) to service_role;

alter table public.myfans_approved_media enable row level security;
revoke all on table public.myfans_approved_media from anon, authenticated;
