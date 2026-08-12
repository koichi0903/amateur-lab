import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api/",
        "/test",
      ],
    },
    sitemap: "https://amateur-lab.vercel.app/sitemap.xml",
    host: "https://amateur-lab.vercel.app",
  };
}
