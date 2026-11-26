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
      console.error("[guide-affiliate-click] analytics event failed", {
        guideSlug,
        ctaKey,
        error: error instanceof Error ? error.message : "unknown",
      });
    }

    const payload = JSON.stringify({
      guideSlug,
      ctaKey,
      requestId: typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
    });

    // The affiliate anchor opens a new tab, so this page remains alive.
    // A keepalive fetch is sent on every click instead of relying on beacon's
    // queue-accepted signal, which did not produce a server-side record.
    void fetch("/api/guide-affiliate-click", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
      keepalive: true,
    }).then((response) => {
      if (!response.ok) {
        console.error("[guide-affiliate-click] request failed", {
          guideSlug,
          ctaKey,
          status: response.status,
        });
      }
    }).catch((error: unknown) => {
      console.error("[guide-affiliate-click] request could not be sent", {
        guideSlug,
        ctaKey,
        error: error instanceof Error ? error.message : "unknown",
      });
    });
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
