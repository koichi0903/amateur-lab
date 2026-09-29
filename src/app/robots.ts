import type { MetadataRoute } from "next";
import { IS_VERCEL_PREVIEW, SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  if (IS_VERCEL_PREVIEW) {
    return {
      rules: { userAgent: "*", disallow: "/" },
      host: SITE_URL,
    };
  }

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
      ...["AhrefsBot", "AwarioBot", "SemrushBot"].map((userAgent) => ({
        userAgent,
        disallow: "/works/",
      })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
