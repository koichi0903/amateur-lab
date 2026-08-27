import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const chromiumFiles = [
  "node_modules/@sparticuz/chromium/**/*",
  "node_modules/playwright-core/**/*",
];

const shouldBundleServerlessChromium =
  process.env.ENABLE_VERCEL_PLAYWRIGHT === "true" || !process.env.VERCEL;

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "amateur-lab.vercel.app" }],
        destination: "https://hakkutsu-lab.com/:path*",
        permanent: true,
      },
    ];
  },
  serverExternalPackages: [
    "@sparticuz/chromium",
    "playwright-core",
  ],
  ...(shouldBundleServerlessChromium
    ? {
        outputFileTracingIncludes: {
          "/*": chromiumFiles,
        },
      }
    : {}),
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

export default withSentryConfig(nextConfig, {
  org: "amateur-lab",
  project: "javascript-nextjs",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
