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
  staticPageGenerationTimeout: 180,
  async redirects() {
    return [
      {
        source: "/admin/myfans/x-growth",
        destination: "/admin/myfans?media=1",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "amateur-lab.vercel.app" }],
        destination: "https://hakkutsu-lab.com/:path*",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/:section(actress|series|maker|genre)/:name",
        has: [{ type: "query", key: "page", value: "(?<page>\\d+)" }],
        destination: "/:section/:name/page/:page",
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:section(actress|genre|maker|series)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=900, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/:section(actress|genre|maker|series)/:name",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=900, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/:section(actress|genre|maker|series)/:name/page/:page",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=900, stale-while-revalidate=86400",
          },
        ],
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
