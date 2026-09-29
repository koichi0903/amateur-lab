import type { Metadata } from "next";

const FALLBACK_SITE_URL = "https://hakkutsu-lab.com";
export const IS_VERCEL_PREVIEW = process.env.VERCEL_ENV === "preview";
const PREVIEW_SITE_URL = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (IS_VERCEL_PREVIEW ? PREVIEW_SITE_URL : null) ||
  FALLBACK_SITE_URL
).replace(/\/$/, "");

export const DEFAULT_ROBOTS = IS_VERCEL_PREVIEW
  ? { index: false, follow: true }
  : { index: true, follow: true };

export function pageMetadata({
  title,
  description,
  canonical,
  image = "/ogp.png",
  robots,
}: {
  title: string;
  description: string;
  canonical: string;
  image?: string;
  robots?: Metadata["robots"];
}): Metadata {
  const ogImage = image === "/ogp.png"
    ? { url: image, width: 1200, height: 630, alt: title }
    : { url: image, alt: title };
  return {
    title,
    description,
    alternates: { canonical },
    robots: robots ?? DEFAULT_ROBOTS,
    openGraph: { title, description, url: canonical, siteName: "発掘LAB", locale: "ja_JP", type: "website", images: [ogImage] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}
