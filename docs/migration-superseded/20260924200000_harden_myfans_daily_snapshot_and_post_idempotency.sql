-- Daily Plan and post persistence contract.
-- This migration is intentionally not applied by the app. Apply it only after
-- the read-only duplicate preflight in the release procedure succeeds.

-- Legacy duplicate normalization. These are the exact, previously audited
-- empty snapshots in Production: 2026-09-08 keeps id 9 (latest evaluation),
-- and 2026-09-14 keeps id 33 (revision 3 and latest evaluation). Any change
-- to this known set, or any child history, aborts the migration.
do $$
declare
  v_duplicate_count integer;
  v_child_count integer;
begin
  select count(*) into v_duplicate_count
  from public.myfans_daily_plans
  where id in (6, 7, 8, 9, 26, 27, 28, 29, 30, 31, 32, 33)
    and approved_media_id is null
    and plan_date in (date '2026-09-08', date '2026-09-14');

  if v_duplicate_count <> 12 then
    raise exception 'MYFANS_LEGACY_PLAN_SET_CHANGED: expected 12 known rows, found %', v_duplicate_count;
  end if;

  if exists (
    select 1 from public.myfans_daily_plans
    where plan_date = date '2026-09-08' and approved_media_id is null
      and id not in (6, 7, 8, 9)
  ) or exists (
    select 1 from public.myfans_daily_plans
    where plan_date = date '2026-09-14' and approved_media_id is null
      and id not in (26, 27, 28, 29, 30, 31, 32, 33)
  ) then
    raise exception 'MYFANS_LEGACY_PLAN_SET_CHANGED: unexpected duplicate rows found';
  end if;

  if exists (
    select 1 from public.myfans_daily_plans
    where id in (6, 7, 8) and (revision <> 1 or created_at <> updated_at)
  ) or exists (
    select 1 from public.myfans_daily_plans
    where id in (26, 27, 28, 29, 30, 31, 32)
      and (revision <> 1 or created_at <> updated_at)
  ) or not exists (
    select 1 from public.myfans_daily_plans
    where id = 9 and plan_date = date '2026-09-08' and revision = 1
  ) or not exists (
    select 1 from public.myfans_daily_plans
    where id = 33 and plan_date = date '2026-09-14' and revision = 3
  ) then
    raise exception 'MYFANS_LEGACY_PLAN_SET_CHANGED: revision or timestamp guard failed';
  end if;

  select count(*) into v_child_count
  from public.myfans_daily_plan_posts
  where daily_plan_id in (6, 7, 8, 26, 27, 28, 29, 30, 31, 32);
  if v_child_count <> 0 then
    raise exception 'MYFANS_LEGACY_PLAN_CHILDREN_PRESENT: plan_posts=%', v_child_count;
  end if;

  select count(*) into v_child_count
  from public.myfans_daily_plan_funnel_audit
  where daily_plan_id in (6, 7, 8, 26, 27, 28, 29, 30, 31, 32);
  if v_child_count <> 0 then
    raise exception 'MYFANS_LEGACY_PLAN_CHILDREN_PRESENT: funnel_audit=%', v_child_count;
  end if;

  delete from public.myfans_daily_plans
  where id in (6, 7, 8, 26, 27, 28, 29, 30, 31, 32);
end;
$$;

do $$
begin
  if exists (
    select 1
    from public.myfans_daily_plans
    group by coalesce(approved_media_id, 0), plan_date
    having count(*) > 1
  ) then
    raise exception 'MYFANS_DAILY_PLAN_DUPLICATES_PRESENT: resolve duplicate approved_media_id/plan_date rows before applying this migration';
  end if;
end;
$$;

alter table public.myfans_daily_plans
  drop constraint if exists myfans_daily_plans_approved_media_id_plan_date_key;

create unique index if not exists myfans_daily_plans_media_date_coalesce_uidx
  on public.myfans_daily_plans (coalesce(approved_media_id, 0), plan_date);

alter table public.myfans_x_posts
  add column if not exists idempotency_key text;

create unique index if not exists myfans_x_posts_idempotency_key_uidx
  on public.myfans_x_posts (idempotency_key)
  where idempotency_key is not null and idempotency_key <> '';

-- The function is internal: all callers use the server-side service_role key.
-- The advisory lock also covers the historical nullable approved_media_id case,
-- for which a normal PostgreSQL unique constraint does not consider NULLs equal.
create or replace function public.save_myfans_daily_snapshot(
  p_plan jsonb,
  p_posts jsonb,
  p_attention jsonb,
  p_linkage jsonb,
  p_outbound jsonb,
  p_audit jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_media_id bigint := nullif(p_plan->>'approved_media_id', '')::bigint;
  v_plan_date date := (p_plan->>'plan_date')::date;
  v_plan_id bigint;
  v_revision integer;
  v_replaced boolean := false;
begin
  if v_plan_date is null then
    raise exception 'MYFANS_DAILY_PLAN_INVALID_DATE';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(coalesce(v_media_id::text, 'null') || ':' || v_plan_date::text, 0)
  );

  select id, revision
    into v_plan_id, v_revision
  from public.myfans_daily_plans
  where approved_media_id is not distinct from v_media_id
    and plan_date = v_plan_date
  order by id desc
  limit 1
  for update;

  if v_plan_id is null then
    insert into public.myfans_daily_plans (
      approved_media_id, plan_date, operation_day, stage, plan_key,
      strategy_json, revision, evaluated_at, source_counts_json
    ) values (
      v_media_id, v_plan_date,
      coalesce(nullif(p_plan->>'operation_day', '')::integer, 1),
      coalesce(p_plan->>'stage', ''), coalesce(p_plan->>'plan_key', ''),
      coalesce(p_plan->'strategy_json', '{}'::jsonb),
      1, (p_plan->>'evaluated_at')::timestamptz,
      coalesce(p_plan->'source_counts_json', '{}'::jsonb)
    ) returning id, revision into v_plan_id, v_revision;
  else
    v_revision := coalesce(v_revision, 0) + 1;
    update public.myfans_daily_plans
    set operation_day = coalesce(nullif(p_plan->>'operation_day', '')::integer, operation_day),
        stage = coalesce(p_plan->>'stage', stage),
        plan_key = coalesce(p_plan->>'plan_key', plan_key),
        strategy_json = coalesce(p_plan->'strategy_json', strategy_json),
        revision = v_revision,
        evaluated_at = (p_plan->>'evaluated_at')::timestamptz,
        source_counts_json = coalesce(p_plan->'source_counts_json', source_counts_json),
        updated_at = pg_catalog.now()
    where id = v_plan_id;
    v_replaced := true;
  end if;

  delete from public.myfans_daily_plan_posts where daily_plan_id = v_plan_id;
  insert into public.myfans_daily_plan_posts (
    daily_plan_id, product_id, quote_candidate_id, post_order, post_role,
    audience_intent, hook_type, creative_strategy, quality_score,
    quality_verdict, evidence_json, generator_version, copy_input_hash,
    body, self_reply, option_label, option_name, option_rank, is_selected,
    selected_at, novelty_json
  )
  select v_plan_id, x.product_id, x.quote_candidate_id, x.post_order, x.post_role,
    x.audience_intent, x.hook_type, x.creative_strategy, x.quality_score,
    x.quality_verdict, x.evidence_json, x.generator_version, x.copy_input_hash,
    x.body, x.self_reply, x.option_label, x.option_name, x.option_rank,
    x.is_selected, x.selected_at, x.novelty_json
  from jsonb_to_recordset(coalesce(p_posts, '[]'::jsonb)) as x(
    product_id bigint, quote_candidate_id bigint, post_order integer,
    post_role text, audience_intent text, hook_type text,
    creative_strategy text, quality_score integer, quality_verdict text,
    evidence_json jsonb, generator_version text, copy_input_hash text,
    body text, self_reply text, option_label text, option_name text,
    option_rank integer, is_selected boolean, selected_at timestamptz,
    novelty_json jsonb
  );

  delete from public.myfans_attention_candidates
  where approved_media_id is not distinct from v_media_id and plan_date = v_plan_date;
  insert into public.myfans_attention_candidates (
    approved_media_id, quote_candidate_id, product_id, plan_date,
    attention_score, score_json, evidence_json
  )
  select v_media_id, x.quote_candidate_id, x.product_id, v_plan_date,
    x.attention_score, x.score_json, x.evidence_json
  from jsonb_to_recordset(coalesce(p_attention, '[]'::jsonb)) as x(
    quote_candidate_id bigint, product_id bigint, attention_score integer,
    score_json jsonb, evidence_json jsonb
  );

  insert into public.myfans_post_product_linkage_evidence (
    approved_media_id, quote_candidate_id, source_status_url,
    source_author_handle, discovered_myfans_url, final_myfans_url,
    product_id, resolution_method, confidence, evidence_source,
    verified_at, metadata, updated_at
  )
  select x.approved_media_id, x.quote_candidate_id, x.source_status_url,
    x.source_author_handle, x.discovered_myfans_url, x.final_myfans_url,
    x.product_id, x.resolution_method, x.confidence, x.evidence_source,
    x.verified_at, x.metadata, pg_catalog.now()
  from jsonb_to_recordset(coalesce(p_linkage, '[]'::jsonb)) as x(
    approved_media_id bigint, quote_candidate_id bigint, source_status_url text,
    source_author_handle text, discovered_myfans_url text, final_myfans_url text,
    product_id bigint, resolution_method text, confidence text,
    evidence_source text, verified_at timestamptz, metadata jsonb
  )
  on conflict (source_status_url, discovered_myfans_url, evidence_source)
  do update set approved_media_id = excluded.approved_media_id,
    quote_candidate_id = excluded.quote_candidate_id,
    source_author_handle = excluded.source_author_handle,
    final_myfans_url = excluded.final_myfans_url,
    product_id = excluded.product_id,
    resolution_method = excluded.resolution_method,
    confidence = excluded.confidence,
    verified_at = excluded.verified_at,
    metadata = excluded.metadata,
    updated_at = pg_catalog.now();

  delete from public.myfans_outbound_tasks
  where approved_media_id is not distinct from v_media_id and plan_date = v_plan_date;
  insert into public.myfans_outbound_tasks (
    approved_media_id, plan_date, task_type, target_url, reason, suggested_text
  )
  select v_media_id, v_plan_date, x.task_type, x.target_url, x.reason, x.suggested_text
  from jsonb_to_recordset(coalesce(p_outbound, '[]'::jsonb)) as x(
    task_type text, target_url text, reason text, suggested_text text
  );

  insert into public.myfans_daily_plan_funnel_audit (daily_plan_id, plan_date, revision, audit_json)
  values (v_plan_id, v_plan_date, v_revision, coalesce(p_audit, '{}'::jsonb));

  return jsonb_build_object('plan_id', v_plan_id, 'revision', v_revision, 'replaced', v_replaced);
end;
$$;

revoke all on function public.save_myfans_daily_snapshot(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_myfans_daily_snapshot(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) to service_role;

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
  v_was_posted boolean := false;
  v_is_posted boolean := coalesce(p_post->>'status', '') = 'posted';
  v_cooldown timestamptz := pg_catalog.now() + interval '30 days';
begin
  if nullif(p_post->>'body', '') is null then
    raise exception 'MYFANS_POST_BODY_REQUIRED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(coalesce(nullif(p_idempotency_key, ''), nullif(p_post->>'id', ''), p_post->>'body'), 0)
  );

  if nullif(p_post->>'id', '') is not null then
    select id, status = 'posted' or posted_at is not null
      into v_post_id, v_was_posted
    from public.myfans_x_posts where id = (p_post->>'id')::bigint for update;
    if v_post_id is null then raise exception 'MYFANS_POST_NOT_FOUND'; end if;
  elsif nullif(p_idempotency_key, '') is not null then
    select id, status = 'posted' or posted_at is not null
      into v_post_id, v_was_posted
    from public.myfans_x_posts where idempotency_key = p_idempotency_key for update;
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
      x_post_url = coalesce(p_post->>'x_post_url', x_post_url),
      actual_posted_by = coalesce(p_post->>'actual_posted_by', actual_posted_by),
      impressions = coalesce(nullif(p_post->>'impressions', '')::integer, impressions),
      likes_count = coalesce(nullif(p_post->>'likes_count', '')::integer, likes_count),
      reposts_count = coalesce(nullif(p_post->>'reposts_count', '')::integer, reposts_count),
      replies_count = coalesce(nullif(p_post->>'replies_count', '')::integer, replies_count),
      clicks = coalesce(nullif(p_post->>'clicks', '')::integer, clicks),
      approved_media_id = case when p_post ? 'approved_media_id' then nullif(p_post->>'approved_media_id', '')::bigint else approved_media_id end,
      approved_media_name = coalesce(p_post->>'approved_media_name', approved_media_name),
      growth_stage = coalesce(p_post->>'growth_stage', growth_stage),
      link_strategy = coalesce(p_post->>'link_strategy', link_strategy),
      cta_strategy = coalesce(p_post->>'cta_strategy', cta_strategy),
      quote_x_url = coalesce(p_post->>'quote_x_url', quote_x_url),
      creative_variant_id = coalesce(p_post->>'creative_variant_id', creative_variant_id),
      creative_strategy = coalesce(p_post->>'creative_strategy', creative_strategy),
      creative_reason = coalesce(p_post->>'creative_reason', creative_reason),
      card_payload = coalesce(p_post->'card_payload', card_payload),
      ogp_check_required = coalesce((p_post->>'ogp_check_required')::boolean, ogp_check_required),
      media_permission_status = coalesce(p_post->>'media_permission_status', media_permission_status),
      planned_slot = coalesce(p_post->>'planned_slot', planned_slot),
      objective = coalesce(p_post->>'objective', objective),
      growth_score_snapshot = coalesce(nullif(p_post->>'growth_score_snapshot', '')::integer, growth_score_snapshot),
      revenue_score_snapshot = coalesce(nullif(p_post->>'revenue_score_snapshot', '')::integer, revenue_score_snapshot),
      creator_ltv_score_snapshot = coalesce(nullif(p_post->>'creator_ltv_score_snapshot', '')::integer, creator_ltv_score_snapshot),
      expected_reward_per_1000_impressions_snapshot = coalesce(nullif(p_post->>'expected_reward_per_1000_impressions_snapshot', '')::integer, expected_reward_per_1000_impressions_snapshot),
      updated_at = pg_catalog.now()
    where id = v_post_id;
  else
    insert into public.myfans_x_posts (
      product_id, post_type, status, body, self_reply, includes_pr, source_x_url,
      affiliate_url, selection_reason, scheduled_at, posted_at, x_post_url,
      actual_posted_by, approved_media_id, approved_media_name, quote_x_url,
      impressions, likes_count, reposts_count, replies_count, clicks,
      growth_stage, link_strategy, cta_strategy, planned_slot, objective,
      growth_score_snapshot, revenue_score_snapshot, creator_ltv_score_snapshot,
      expected_reward_per_1000_impressions_snapshot, creative_variant_id,
      creative_strategy, creative_reason, card_payload, ogp_check_required,
      media_permission_status, idempotency_key, created_at, updated_at
    ) values (
      nullif(p_post->>'product_id', '')::bigint, coalesce(p_post->>'post_type', 'discovery'),
      coalesce(p_post->>'status', 'draft'), p_post->>'body', coalesce(p_post->>'self_reply', ''),
      coalesce((p_post->>'includes_pr')::boolean, true), coalesce(p_post->>'source_x_url', ''),
      coalesce(p_post->>'affiliate_url', ''), coalesce(p_post->>'selection_reason', ''),
      (p_post->>'scheduled_at')::timestamptz, (p_post->>'posted_at')::timestamptz,
      coalesce(p_post->>'x_post_url', ''), coalesce(p_post->>'actual_posted_by', ''),
      nullif(p_post->>'approved_media_id', '')::bigint, coalesce(p_post->>'approved_media_name', ''),
      coalesce(p_post->>'quote_x_url', ''),
      coalesce(nullif(p_post->>'impressions', '')::integer, 0), coalesce(nullif(p_post->>'likes_count', '')::integer, 0),
      coalesce(nullif(p_post->>'reposts_count', '')::integer, 0), coalesce(nullif(p_post->>'replies_count', '')::integer, 0),
      coalesce(nullif(p_post->>'clicks', '')::integer, 0), coalesce(p_post->>'growth_stage', ''),
      coalesce(p_post->>'link_strategy', 'no_link'), coalesce(p_post->>'cta_strategy', ''),
      coalesce(p_post->>'planned_slot', ''), coalesce(p_post->>'objective', 'impression'),
      coalesce(nullif(p_post->>'growth_score_snapshot', '')::integer, 0), coalesce(nullif(p_post->>'revenue_score_snapshot', '')::integer, 0),
      coalesce(nullif(p_post->>'creator_ltv_score_snapshot', '')::integer, 0), coalesce(nullif(p_post->>'expected_reward_per_1000_impressions_snapshot', '')::integer, 0),
      coalesce(p_post->>'creative_variant_id', ''), coalesce(p_post->>'creative_strategy', 'text_only'),
      coalesce(p_post->>'creative_reason', ''), coalesce(p_post->'card_payload', '{}'::jsonb),
      coalesce((p_post->>'ogp_check_required')::boolean, false), coalesce(p_post->>'media_permission_status', 'unknown'),
      nullif(p_idempotency_key, ''),
      pg_catalog.now(), pg_catalog.now()
    ) returning id into v_post_id;
  end if;

  if v_is_posted and not v_was_posted and nullif(p_quote_x_url, '') is not null then
    update public.myfans_quote_candidates
    set selected_for_today = true, last_used_at = pg_catalog.now(),
        cooldown_until = v_cooldown, use_count = use_count + 1
    where x_post_url = p_quote_x_url;
  end if;

  if v_is_posted then
    insert into public.myfans_permanent_candidate_exclusions
      (entity_type, entity_key, product_id, source_status_url, reason, context)
    select 'product', 'product:' || product_id::text, product_id, null, 'posted',
      jsonb_build_object('recorded_from', 'myfans_x_posts', 'post_id', v_post_id)
    from public.myfans_x_posts where id = v_post_id and product_id is not null
    on conflict (entity_type, entity_key) do nothing;

    insert into public.myfans_permanent_candidate_exclusions
      (entity_type, entity_key, product_id, source_status_url, reason, context)
    select 'source', 'source:' || lower(trim(coalesce(nullif(quote_x_url, ''), nullif(source_x_url, '')))), null,
      coalesce(nullif(quote_x_url, ''), nullif(source_x_url, '')), 'posted',
      jsonb_build_object('recorded_from', 'myfans_x_posts', 'post_id', v_post_id)
    from public.myfans_x_posts
    where id = v_post_id and product_id is null
      and nullif(trim(coalesce(nullif(quote_x_url, ''), nullif(source_x_url, ''))), '') is not null
    on conflict (entity_type, entity_key) do nothing;
  end if;

  return jsonb_build_object('post_id', v_post_id, 'incremented', v_is_posted and not v_was_posted);
end;
$$;

revoke all on function public.save_myfans_post(jsonb, text, text) from public, anon, authenticated;
grant execute on function public.save_myfans_post(jsonb, text, text) to service_role;
