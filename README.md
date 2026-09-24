This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Local admin development

The current Myfans integration server runs on port 3000. Start the canonical local server with:

```powershell
npm run dev:local
```

The launcher resolves its own repository root, verifies `.env.local` without printing its values, and records the PID, checkout, and Git HEAD in `%LOCALAPPDATA%\amateur-lab\local-dev-3000.json`. It reuses only a server previously started by this launcher from the same checkout. An unverified or different checkout is reported and never stopped automatically.

Open [http://localhost:3000/admin](http://localhost:3000/admin) and use the `myfans X運用` card. The canonical Myfans command center in this integration is [http://localhost:3000/admin/myfans?media=1](http://localhost:3000/admin/myfans?media=1).

Port ownership is intentional: `localhost:3000` is this `amateur-lab-myfans-0.1.38-integration` worktree; `localhost:3001` is the separate canonical application used for FANZA acceptance. Do not point the 0.1.38 Companion at 3001. The Companion performs a read-only database preflight before creating a new collection job.

For a secret-free startup fingerprint, run:

```bash
node scripts/myfans-runtime-fingerprint.mjs
```

It prints only the role, port, worktree, HEAD, and whether the local HTTP endpoint responds; it never prints environment values.

The old `/admin/myfans/x-growth` path is retained only as a permanent server redirect to the canonical command center; it does not render the former UI.

The Companion create endpoint fails fast with `DB_PREFLIGHT_FAILED` before any job write when the read-only Supabase probe cannot connect. The formal audit constraint and atomic job/items RPC are defined in `supabase/migrations/20260924143000_formalize_myfans_quote_refresh_atomic_create.sql`; this migration must be reviewed and applied to Production before real collection is enabled. Until then, the compatibility path compensates any job/items write failure by terminalizing the job and its pending items.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
