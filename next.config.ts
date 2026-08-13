import type { NextConfig } from "next";

const chromiumFiles = [
  "node_modules/@sparticuz/chromium/bin/**/*",
];

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@sparticuz/chromium",
    "playwright",
    "playwright-core",
  ],
  outputFileTracingIncludes: {
    "/api/*": chromiumFiles,
    "/api/**/*": chromiumFiles,
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
