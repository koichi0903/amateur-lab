-- The application upserts on (approved_media_id, entity_type, entity_key).
-- The existing unique indexes do not match that conflict target: one is
-- partial and the other indexes coalesce(approved_media_id, 0).
--
-- PostgreSQL 15+ supports NULLS NOT DISTINCT, which preserves account-local
-- uniqueness for both legacy NULL account rows and scoped non-NULL rows.
-- Keep the pre-existing indexes in place; this index is additive and can be
-- rolled back independently with DROP INDEX
-- public.myfans_permanent_candidate_exclusions_conflict_target_uidx.
create unique index if not exists myfans_permanent_candidate_exclusions_conflict_target_uidx
  on public.myfans_permanent_candidate_exclusions (approved_media_id, entity_type, entity_key)
  nulls not distinct;
