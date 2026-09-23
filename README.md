This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Local admin development

The current myfans admin runs on port 3000. Start the canonical local server with:

```powershell
npm run dev:local
```

The launcher resolves its own repository root, verifies `.env.local` without printing its values, and records the PID, checkout, and Git HEAD in `%LOCALAPPDATA%\amateur-lab\local-dev-3000.json`. It reuses only a server previously started by this launcher from the same checkout. An unverified or different checkout is reported and never stopped automatically.

Open [http://localhost:3000/admin](http://localhost:3000/admin) and use the `myfans X運用` card. The canonical myfans command center is [http://localhost:3000/admin/myfans?media=1](http://localhost:3000/admin/myfans?media=1).

The old `/admin/myfans/x-growth` path is retained only as a permanent server redirect to the canonical command center; it does not render the former UI.

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
