# Pending migration

`20261017120000_fanza_amateur_catalog_date_ranges.sql` came from `origin/main` and is not applied in the observed database migration history. The user chose to keep it out of `supabase/migrations` pending review. The SQL also updates legacy running-run records; do not apply it as part of cleanup. Its source is preserved here for later review.

No database writes or migration applications were performed during this reconciliation.

## New-database rebuild verification (unresolved)

- A clean development database could not be rebuilt from the active migration directory because the first migration expects `public.works` to exist.
- No baseline schema dump or bootstrap step was found in the repository, reachable Git history, or `origin/main`. The user has no known external source for it, so the required initial schema remains unresolved.
- Keep the 14 active migrations that share exact 8-digit version prefixes across four duplicate groups in place until a valid initial schema and an independent migration-order test are available. Their ordering and new-database reproducibility are not verified.
- Do not apply migrations to the production database as part of this cleanup.

## Source reconciliation decisions

- Applied migration `20261014081448_dedupe_myfans_stale_job_finalized_audit`: the read-only database record contains the duplicate-key guard and archive idempotency, but not the source file's `removed_rows > archived_rows` guard. The user chose to keep this additional guard for new databases, accepting that the source is stricter than the SQL recorded for the applied version. No database write or reapplication was performed.
- Read-only migration history also identifies DB-applied `20260923135903_add_myfans_quote_refresh_item_diagnostics`, whose SQL record creates the same diagnostics columns with nullable/no-default `request_type`; the active repo has no source file for it, and the user previously chose not to restore DB-only SQL. The user chose to keep `NOT NULL DEFAULT 'quote_scan'` in active, unapplied `20260924120000_add_myfans_quote_refresh_item_terminal_contract` for new databases. Application writes explicitly provide `request_type`. The current DB remains nullable with no default, and this migration has not been applied; any DB application remains a separate approval.

## Latest read-only history snapshot (2026-11-02)

- The connected database has 112 migration records; the latest is `20261102064340_restore_fanza_amateur_entity_refresh_delete_guard`. The corresponding active source was restored from a preserved copy, its contents were verified against that copy, and the migration is already recorded in the database. It was not applied or re-run during this check.
- A fresh full-statement comparison found no SQL-body drift for that migration. The database's recorded statement exposes raw CR/LF/tab characters inside escape-string literals, while the source spells them as `\r`, `\n`, and `\t`; after canonicalizing that representation and outer line endings, the complete statement matches.
- The active migration directory has 132 SQL files. Filename comparison found 101 exact version-and-name matches, six DB records with an active same-name source under a different version, and five DB-recorded names without an active same-name source. Thirty-one active files do not exactly match a DB version/name entry, spanning 21 version values. These counts classify filenames only; they do not establish SQL equivalence.
- Four duplicate 8-digit version groups contain 14 active SQL files. They remain active under the user's preservation decision until the missing initial schema is found and an independent new-database migration-order test can run.
- This was a read-only migration-history query. No database writes, migration applications, or Production deployments were performed.

## Same-name, version-different SQL still unresolved

- In the comparison snapshot before `20261102064340` was applied, the connected DB ledger had 111 rows and the active migration directory had 131 files. It found six DB migrations whose name matches an active SQL file but whose version differs. After removing SQL comments, normalizing whitespace, and normalizing unquoted SQL case, all six active files still differed from the DB-recorded statement. Per the user's rule, only execution-SQL matches may be aligned to the DB version; these files were not renamed or overwritten.
- `20260907_add_myfans_quote_visual_media.sql` vs DB `20260907073232`: both define the visual fields, but active SQL also adds `media_permalink_verified_at` and `media_permalink_validation_status`. Those columns are recorded under the later DB-only version `20260907075401`; the user chose not to restore its SQL source.
- `20260912_add_x_media_asset_trim_start.sql` vs DB `20260912020039`: active SQL adds `trim_modify_confirmed`; the DB statement does not.
- `20260914_add_x_post_attribution.sql` vs DB `20260914075622`: active SQL adds attribution indexes beyond the recorded column addition.
- `20260915_add_myfans_post_product_linkage_evidence.sql` vs DB `20260915094054`: the `metadata` column appears in a different position in the table definition.
- `20260918_add_bijyo_reserved_auto_post.sql` vs DB `20260918140945`: status constraints describe different workflows (the active file includes manual-post, skip, and trim-failure states; the DB record includes posting and reply states).
- `20260919_switch_bijyo_to_manual_workflow.sql` vs DB `20260919041639`: active SQL adds the manual-state columns, converts legacy statuses, recreates the manual-state constraint, and disables the account setting. The DB-recorded SQL additionally creates and initializes `bijyo_reserved_settings`; the active `20260918` source already creates that table.
- Keep these active sources unchanged and treat them as unresolved migration history. Do not rename them as DB-equivalent or remove them until their intended new-database behavior and provenance are reviewed. No database writes or migration applications were performed during this comparison.

## Follow-up source inventory (2026-11-03)

- A read-only recheck of the connected project found the same 112 database migration records and 132 active SQL files. The 101 exact version-and-name matches, six same-name files under another active version, and five database names without an active same-name file remain unchanged.
- Four applied database migration records have no matching SQL source in the canonical checkout, any of the 33 registered worktrees, `docs/migration-superseded`, or reachable Git object paths: `20260907075401_add_myfans_quote_media_permalink_validation_status`, `20260909104438_add_myfans_quote_visual_render_status`, `20260912020215_add_x_media_asset_trim_modify_confirmed`, and `20260923135903_add_myfans_quote_refresh_item_diagnostics`.
- Do not reconstruct or restore these SQL files from the database record. The user chose to preserve these as database-only migration history. Record their applied versions and names here; new-database replay remains unverified for these changes.
- The fifth database name without an active same-name file is `20260926062909_add_actress_works_by_release_date`; its preserved source is available only as `docs/migration-superseded/20260926_add_actress_works_by_release_date.sql` and remains audit-only.
- Related-work migration `20261101135306_optimize_fanza_amateur_related_work_lookup` is recorded as applied in the connected database and is present in the `origin/main` base history. The separate local-only commit `6ce613fb` is not contained in `origin/main` or PR #37, consistent with the decision to keep that additional implementation local.
- This was a read-only inventory. No migration was applied, edited in the database, or deployed.

## Current schema cross-check for the six mismatches (2026-11-03)

- Re-read the six DB statements and same-name active files. Their SQL token sequences still differ after SQL comments and whitespace are ignored; none qualifies for DB-version renaming under the user's execution-SQL-match rule.
- The connected schema contains both quote permalink validation columns and `x_media_assets.trim_modify_confirmed`; these later DB-only changes are folded into the active 8-digit source files. The database migration ledger still records separate versions whose source files are intentionally not restored.
- The database has `affiliate_clicks_x_post_key_clicked_at_idx`, but no `affiliate_cta_impressions_x_post_key_viewed_at_idx` or `work_page_views_x_post_key_viewed_at_idx`; those two additional indexes appear only in active `20260914_add_x_post_attribution.sql`. Their live-schema absence is recorded; no index was created.
- The database's `metadata` column position in `myfans_post_product_linkage_evidence` is 15 (after `updated_at`), while the active `20260915` source places it before `created_at`. The SQL difference is retained rather than rewritten as an exact history match.
- The live `bijyo_reserved_post_jobs` constraint uses the manual states (`pending`, `posted`, `manual_posted`, `skipped`, `excluded`, `trim_failed`) and the corresponding trim columns exist. The active `20260918` file starts with that manual-state schema; the database ledger instead has the original auto workflow followed by the `20260919` transition.
- This was a read-only schema and migration-ledger inspection. It does not prove a clean-database replay because the initial `public.works` schema is still missing; no DB DDL or migration execution was performed.
