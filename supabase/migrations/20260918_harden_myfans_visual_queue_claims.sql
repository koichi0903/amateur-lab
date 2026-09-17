alter table public.myfans_visual_verification_queue
  add column if not exists claim_token uuid,
  add column if not exists claimed_at timestamptz,
  add column if not exists claim_expires_at timestamptz;

create index if not exists myfans_visual_verification_queue_active_claim_idx
  on public.myfans_visual_verification_queue (job_id, status, claim_expires_at);

create or replace function public.claim_myfans_visual_verification_batch(
  p_job_id bigint,
  p_requested_limit integer default 5,
  p_claim_token uuid default gen_random_uuid()
)
returns setof public.myfans_visual_verification_queue
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_job public.myfans_visual_verification_jobs;
  v_limit integer;
  v_active integer;
begin
  v_limit := greatest(1, least(coalesce(p_requested_limit, 5), 5));

  select * into v_job
    from public.myfans_visual_verification_jobs
   where id = p_job_id
   for update;
  if not found or v_job.status not in ('pending', 'running') then
    return;
  end if;

  update public.myfans_visual_verification_queue
     set status = 'pending', claim_token = null, claimed_at = null,
         claim_expires_at = null, updated_at = now()
   where job_id = p_job_id
     and status = 'processing'
     and claim_expires_at is not null
     and claim_expires_at < now()
     and processed_at is null;

  select count(*)::integer into v_active
    from public.myfans_visual_verification_queue
   where job_id = p_job_id
     and status = 'processing'
     and processed_at is null
     and (claim_expires_at is null or claim_expires_at >= now());

  v_limit := greatest(0, least(v_limit, 5 - v_active));
  if v_limit = 0 then
    return;
  end if;

  return query
  with picked as (
    select id
      from public.myfans_visual_verification_queue
     where job_id = p_job_id and status = 'pending'
     order by id
     for update skip locked
     limit v_limit
  )
  update public.myfans_visual_verification_queue q
     set status = 'processing', attempt_count = q.attempt_count + 1,
         claim_token = p_claim_token, claimed_at = now(),
         claim_expires_at = now() + interval '15 minutes', updated_at = now()
    from picked
   where q.id = picked.id
  returning q.*;
end;
$$;

revoke all on function public.claim_myfans_visual_verification_batch(bigint, integer, uuid) from public, anon, authenticated;
grant execute on function public.claim_myfans_visual_verification_batch(bigint, integer, uuid) to service_role;
