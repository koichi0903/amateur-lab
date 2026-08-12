import type { Metadata } from "next";

const FALLBACK_SITE_URL = "https://amateur-lab.vercel.app";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || FALLBACK_SITE_URL).replace(/\/$/, "");

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
    robots: robots ?? { index: true, follow: true },
    openGraph: { title, description, url: canonical, siteName: "発掘LAB", locale: "ja_JP", type: "website", images: [ogImage] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}
