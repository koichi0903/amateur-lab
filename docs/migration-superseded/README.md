# Superseded migration source archive

These SQL files preserve historical source paths removed from `supabase/migrations` during the approved migration reconciliation. They are audit copies only and must not be applied. Supabase's active migration directory remains `supabase/migrations`.

Each SQL file was copied byte-for-byte from the exact Git source recorded in `manifest.csv`: 54 from the current branch's HEAD, seven earlier migration paths from `HEAD^` or commit `c8e6cc3204939470f23ca27eed325942397c7dfa`, and one from `origin/main` commit `2696cec7d245cadc099dde3eb538523134b7aceb`. The manifest records Git blob IDs and SHA-256 hashes. Of the 62 archive files, 61 have a same-slug active counterpart; 60 match after line-ending normalization and SQL token comparison. One differs from its active counterpart, and one has no active counterpart. These comparisons do not establish equality with the database's executed SQL.
