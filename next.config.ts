import type { NextConfig } from "next";

const chromiumFiles = [
  "node_modules/@sparticuz/chromium/**/*",
  "node_modules/playwright-core/**/*",
];

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  serverExternalPackages: [
    "@sparticuz/chromium",
    "playwright-core",
  ],
  outputFileTracingIncludes: {
    "/*": chromiumFiles,
  },
  images: {
    // DMM images are already served by their CDN. Bypass Vercel's image
    // optimizer so crawlers cannot exhaust the Hobby Edge Request quota.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pics.dmm.co.jp",
      },
    ],
  },
};

export default nextConfig;
