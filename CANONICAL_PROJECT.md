# amateur-lab canonical project

This repository is the single canonical project for the FANZA affiliate, Myfans, and bijyo operations.

- Local canonical path: `C:\Users\DELL\Documents\Codex\amateur-lab-myfans-daily-funnel-audit`
- Git remote: `https://github.com/koichi0903/amateur-lab.git`
- Branch: `main`
- Local start command: `npm run dev:local`
- FANZA: `/admin/x-growth`
- Myfans: `/admin/myfans?media=1`
- bijyo: `/admin/bijyo-reserved`
- Vercel project: `amateur-lab`
- Production domain: `hakkutsu-lab.com`

This checkout is the single canonical local development environment. Other worktrees and the older `C:\Users\DELL\projects\amateur-lab` clone are not providers of `localhost:3000`. Before declaring READY, run `npm run verify:canonical` here and confirm that this checkout, `origin/main`, and the port-3000 server agree.

The verification command is read-only. It does not deploy, mutate the database, collect X data, or post to X.
