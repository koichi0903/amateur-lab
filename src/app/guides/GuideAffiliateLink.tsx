"use client";

import type { ReactNode, MouseEvent } from "react";
import { HAKKUTSU_SITE_DMM_AFFILIATE_ID } from "@/lib/dmm/siteAffiliateUrl";

type Props = {
  href: string;
  guideSlug: string;
  ctaKey: string;
  className?: string;
  children: ReactNode;
};

type WindowWithGtag = Window & {
  gtag?: (command: string, eventName: string, params: Record<string, string>) => void;
};

export default function GuideAffiliateLink({
  href,
  guideSlug,
  ctaKey,
  className,
  children,
}: Props) {
  const pingUrl = `/api/guide-affiliate-click?guideSlug=${encodeURIComponent(guideSlug)}&ctaKey=${encodeURIComponent(ctaKey)}`;

  const recordAnalyticsClick = (_event: MouseEvent<HTMLAnchorElement>) => {
    try {
      (window as WindowWithGtag).gtag?.("event", "affiliate_click", {
        placement: "guide-cta",
        source_page: "guides",
        guide_slug: guideSlug,
        guide_cta_key: ctaKey,
        affiliate_id: HAKKUTSU_SITE_DMM_AFFILIATE_ID,
        link_url: href,
        transport_type: "beacon",
      });
    } catch (error) {
      // Analytics must not interfere with the browser-native click ping.
      console.error("[guide-affiliate-click] analytics event failed", {
        guideSlug,
        ctaKey,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  };

  return (
    <a
      href={href}
      target="_blank"
      rel="sponsored noopener noreferrer"
      ping={pingUrl}
      className={className}
      onClick={recordAnalyticsClick}
    >
      {children}
    </a>
  );
}
