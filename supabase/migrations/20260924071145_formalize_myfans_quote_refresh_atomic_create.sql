-- Formal Myfans Companion contract. This migration is intentionally not applied by the app.
-- It never deletes or rewrites existing rows.

alter table public.myfans_audit_logs
  drop constraint if exists myfans_audit_logs_entity_type_check;

alter table public.myfans_audit_logs
  add constraint myfans_audit_logs_entity_type_check
  check (entity_type in (
    'creator', 'product', 'x_post', 'conversion', 'click', 'media', 'import',
    'evidence', 'quote_refresh_job', 'quote_refresh_job_item'
  ));

-- collection_session_id is the Companion idempotency key. Existing legacy rows are
-- excluded because they have no session identity.
create unique index if not exists myfans_quote_refresh_jobs_active_session_uidx
  on public.myfans_quote_refresh_jobs (collection_session_id)
  where collection_session_id is not null and status in ('pending', 'running', 'paused');

create or replace function public.create_myfans_quote_refresh_job(
  p_job jsonb,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing_id bigint;
  v_job_id bigint;
begin
  select id into v_existing_id
  from public.myfans_quote_refresh_jobs
  where collection_session_id = nullif(p_job->>'collection_session_id', '')
    and status in ('pending', 'running', 'paused')
  order by created_at desc
  limit 1;

  if v_existing_id is not null then
    return jsonb_build_object('job_id', v_existing_id, 'reused', true);
  end if;

  insert into public.myfans_quote_refresh_jobs (
    approved_media_id, status, total_creators, batch_size,
    rotation_cooldown_days, minimum_rotation_cooldown_days,
    eligible_creators, cooldown_excluded_creators, selection_mode,
    selection_note, collection_cycle_no, cursor_before_order,
    cursor_after_order, cycle_completed, sensitive_gate_streak_limit,
    sensitive_gate_streak, collection_session_id, collection_run_token,
    launch_mode, collector_version
  ) values (
    nullif(p_job->>'approved_media_id', '')::bigint,
    coalesce(nullif(p_job->>'status', ''), 'pending'),
    coalesce(nullif(p_job->>'total_creators', '')::integer, 0),
    coalesce(nullif(p_job->>'batch_size', '')::integer, 25),
    coalesce(nullif(p_job->>'rotation_cooldown_days', '')::integer, 1),
    coalesce(nullif(p_job->>'minimum_rotation_cooldown_days', '')::integer, 1),
    coalesce(nullif(p_job->>'eligible_creators', '')::integer, 0),
    coalesce(nullif(p_job->>'cooldown_excluded_creators', '')::integer, 0),
    coalesce(nullif(p_job->>'selection_mode', ''), 'strict'),
    coalesce(p_job->>'selection_note', ''),
    coalesce(nullif(p_job->>'collection_cycle_no', '')::integer, 1),
    coalesce(nullif(p_job->>'cursor_before_order', '')::integer, 0),
    nullif(p_job->>'cursor_after_order', '')::integer,
    coalesce((p_job->>'cycle_completed')::boolean, false),
    coalesce(nullif(p_job->>'sensitive_gate_streak_limit', '')::integer, 3),
    coalesce(nullif(p_job->>'sensitive_gate_streak', '')::integer, 0),
    nullif(p_job->>'collection_session_id', ''),
    nullif(p_job->>'collection_run_token', ''),
    coalesce(nullif(p_job->>'launch_mode', ''), 'new'),
    nullif(p_job->>'collector_version', '')
  ) returning id into v_job_id;

  insert into public.myfans_quote_refresh_job_items (job_id, creator_id, creator_x_url)
  select v_job_id, item.creator_id, item.creator_x_url
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as item(creator_id bigint, creator_x_url text);

  return jsonb_build_object('job_id', v_job_id, 'reused', false);
exception when unique_violation then
  select id into v_existing_id
  from public.myfans_quote_refresh_jobs
  where collection_session_id = nullif(p_job->>'collection_session_id', '')
    and status in ('pending', 'running', 'paused')
  order by created_at desc
  limit 1;
  if v_existing_id is not null then
    return jsonb_build_object('job_id', v_existing_id, 'reused', true);
  end if;
  raise;
end;
$$;

revoke all on function public.create_myfans_quote_refresh_job(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.create_myfans_quote_refresh_job(jsonb, jsonb) to service_role;
