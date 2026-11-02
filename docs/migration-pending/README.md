# Pending migration

`20261017120000_fanza_amateur_catalog_date_ranges.sql` came from `origin/main` and is not applied in the observed database migration history. The user chose to keep it out of `supabase/migrations` pending review. The SQL also updates legacy running-run records; do not apply it as part of cleanup. Its source is preserved here for later review.

No database writes or migration applications were performed during this reconciliation.

## New-database rebuild verification (unresolved)

- A clean development database could not be rebuilt from the active migration directory because the first migration expects `public.works` to exist.
- No baseline schema dump or bootstrap step was found in the repository, reachable Git history, or `origin/main`. The user has no known external source for it, so the required initial schema remains unresolved.
- Keep the 14 active migrations that share exact 8-digit version prefixes across four duplicate groups in place until a valid initial schema and an independent migration-order test are available. Their ordering and new-database reproducibility are not verified.
- Do not apply migrations to the production database as part of this cleanup.
