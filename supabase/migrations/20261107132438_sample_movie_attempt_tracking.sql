alter table public.works
  add column sample_movie_attempt_count smallint not null default 0,
  add column sample_movie_status text not null default 'pending',
  add constraint works_sample_movie_attempt_count_check
    check (sample_movie_attempt_count between 0 and 3),
  add constraint works_sample_movie_status_check
    check (sample_movie_status in ('pending', 'found', 'no_video'));

comment on column public.works.sample_movie_attempt_count is
  'Count of confirmed checks that found no sample movie; capped at 3. Transport/browser errors do not increment it.';
comment on column public.works.sample_movie_status is
  'Derived by the sample movie trigger: pending, found, or terminal no_video after 3 confirmed empty checks.';

-- Historical rows only retain the last checked timestamp, not exact attempt
-- counts. Seed known checked misses as a conservative minimum of one.
update public.works
set sample_movie_attempt_count = 1
where sample_movie_url is null
  and sample_movie_checked_at is not null;

update public.works
set sample_movie_status = case
  when nullif(btrim(sample_movie_url), '') is not null then 'found'
  else 'pending'
end;

create or replace function private.track_sample_movie_attempt_state()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.sample_movie_attempt_count := greatest(
      coalesce(old.sample_movie_attempt_count, 0),
      coalesce(new.sample_movie_attempt_count, 0)
    );

    if new.sample_movie_url is null
       and new.sample_movie_checked_at is distinct from old.sample_movie_checked_at then
      new.sample_movie_attempt_count := least(
        coalesce(old.sample_movie_attempt_count, 0) + 1,
        3
      );
    end if;
  end if;

  if nullif(btrim(new.sample_movie_url), '') is not null then
    new.sample_movie_status := 'found';
  elsif new.sample_movie_attempt_count >= 3 then
    new.sample_movie_status := 'no_video';
  else
    new.sample_movie_status := 'pending';
  end if;

  return new;
end;
$$;

create trigger works_track_sample_movie_attempt_state
before insert or update of sample_movie_url, sample_movie_checked_at, sample_movie_attempt_count
on public.works
for each row
execute function private.track_sample_movie_attempt_state();

create index works_sample_movie_pending_idx
  on public.works (sample_movie_checked_at, product_id)
  where sample_movie_url is null
    and sample_movie_status <> 'no_video'
    and stage <> 'DISCONTINUED';
