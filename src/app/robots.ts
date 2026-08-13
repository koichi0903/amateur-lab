import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/"],
      },
      ...[
        "Amazonbot",
        "anthropic-ai",
        "Applebot-Extended",
        "Bytespider",
        "CCBot",
        "ChatGPT-User",
        "ClaudeBot",
        "Claude-Web",
        "cohere-ai",
        "Diffbot",
        "FacebookBot",
        "Google-Extended",
        "GPTBot",
        "ImagesiftBot",
        "Meta-ExternalAgent",
        "Omgilibot",
        "PerplexityBot",
        "YouBot",
      ].map((userAgent) => ({
        userAgent,
        disallow: "/",
      })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
