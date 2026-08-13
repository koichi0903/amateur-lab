import type { NextConfig } from "next";

const chromiumFiles = [
  "node_modules/@sparticuz/chromium/**/*",
  "node_modules/playwright-core/**/*",
];

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@sparticuz/chromium",
    "playwright-core",
  ],
  outputFileTracingIncludes: {
    "/*": chromiumFiles,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pics.dmm.co.jp",
      },
    ],
  },
};

export default nextConfig;
