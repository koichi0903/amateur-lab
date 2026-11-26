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
  const recordClick = (_event: MouseEvent<HTMLAnchorElement>) => {
    const eventParams = {
      placement: "guide-cta",
      source_page: "guides",
      guide_slug: guideSlug,
      guide_cta_key: ctaKey,
      affiliate_id: HAKKUTSU_SITE_DMM_AFFILIATE_ID,
      link_url: href,
      transport_type: "beacon",
    };

    (window as WindowWithGtag).gtag?.("event", "affiliate_click", eventParams);

    // Keep the outbound navigation immediate; the request can finish after the new tab opens.
    void fetch("/api/guide-affiliate-click", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ guideSlug, ctaKey }),
      keepalive: true,
    }).catch(() => undefined);
  };

  return (
    <a
      href={href}
      target="_blank"
      rel="sponsored noopener noreferrer"
      className={className}
      onClick={recordClick}
    >
      {children}
    </a>
  );
}
