# Pending migration

`20261017120000_fanza_amateur_catalog_date_ranges.sql` came from `origin/main` and is not applied in the observed database migration history. The user chose to keep it out of `supabase/migrations` pending review. The SQL also updates legacy running-run records; do not apply it as part of cleanup. Its source is preserved here for later review.

No database writes or migration applications were performed during this reconciliation.

## New-database rebuild verification (unresolved)

- A clean development database could not be rebuilt from the active migration directory because the first migration expects `public.works` to exist.
- No baseline schema dump or bootstrap step was found in the repository, reachable Git history, or `origin/main`. The user has no known external source for it, so the required initial schema remains unresolved.
- Keep the 14 active migrations that share exact 8-digit version prefixes across four duplicate groups in place until a valid initial schema and an independent migration-order test are available. Their ordering and new-database reproducibility are not verified.
- Do not apply migrations to the production database as part of this cleanup.

## Source reconciliation pending

- Applied migration `20261014081448_dedupe_myfans_stale_job_finalized_audit`: the read-only database record contains the duplicate-key guard and archive idempotency, but not the source file's `removed_rows > archived_rows` guard. Keep the source unchanged until deciding whether the extra guard is intentional for fresh databases or whether the file should match the executed SQL exactly. No database write or reapplication was performed.
- Read-only migration history also identifies DB-applied `20260923135903_add_myfans_quote_refresh_item_diagnostics`, whose SQL record creates the same diagnostics columns with nullable/no-default `request_type`; the active repo has no source file for it, and the user previously chose not to restore DB-only SQL. Active `20260924120000_add_myfans_quote_refresh_item_terminal_contract` remains the available source to create these columns in a new database and currently adds `NOT NULL DEFAULT 'quote_scan'`. App writes explicitly provide `request_type`. The outstanding choice is whether to preserve that stronger new-database constraint or align it to the applied DB schema. Do not apply the migration without separate approval.
