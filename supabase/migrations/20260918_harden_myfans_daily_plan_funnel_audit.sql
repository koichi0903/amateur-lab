create unique index if not exists myfans_daily_plan_funnel_audit_revision_uidx
  on public.myfans_daily_plan_funnel_audit (daily_plan_id, revision)
  where revision is not null;

grant select, insert on table public.myfans_daily_plan_funnel_audit to service_role;
grant usage, select on sequence public.myfans_daily_plan_funnel_audit_id_seq to service_role;

create or replace function public.prevent_myfans_daily_plan_funnel_audit_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  raise exception 'myfans_daily_plan_funnel_audit is append-only';
end;
$$;

drop trigger if exists myfans_daily_plan_funnel_audit_append_only on public.myfans_daily_plan_funnel_audit;
create trigger myfans_daily_plan_funnel_audit_append_only
before update or delete on public.myfans_daily_plan_funnel_audit
for each row execute function public.prevent_myfans_daily_plan_funnel_audit_mutation();
