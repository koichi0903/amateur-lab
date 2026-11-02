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
- `20260907_add_myfans_quote_visual_media.sql` vs DB `20260907073232`: active SQL adds media-permalink validation fields; the DB statement has a visual-score constraint instead.
- `20260912_add_x_media_asset_trim_start.sql` vs DB `20260912020039`: active SQL adds `trim_modify_confirmed`; the DB statement does not.
- `20260914_add_x_post_attribution.sql` vs DB `20260914075622`: active SQL adds attribution indexes beyond the recorded column addition.
- `20260915_add_myfans_post_product_linkage_evidence.sql` vs DB `20260915094054`: the `metadata` column appears in a different position in the table definition.
- `20260918_add_bijyo_reserved_auto_post.sql` vs DB `20260918140945`: status constraints describe different workflows (the active file includes manual-post, skip, and trim-failure states; the DB record includes posting and reply states).
- `20260919_switch_bijyo_to_manual_workflow.sql` vs DB `20260919041639`: the DB statement also creates `bijyo_reserved_settings`; the active file only disables the legacy account setting.
- Keep these active sources unchanged and treat them as unresolved migration history. Do not rename them as DB-equivalent or remove them until their intended new-database behavior and provenance are reviewed. No database writes or migration applications were performed during this comparison.
