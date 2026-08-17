"use client";

import type { ReactNode } from "react";
import type { AffiliateSource } from "@/lib/affiliateTracking";

export type AffiliatePlacement = "detail-sidebar" | "mobile-sticky" | "compare-card";

type Props = {
  href: string;
  workId: number;
  placement: AffiliatePlacement;
  sourcePage: AffiliateSource;
  className?: string;
  ariaLabel?: string;
  children: ReactNode;
};

export default function AffiliateLink({
  href,
  workId,
  placement,
  sourcePage,
  className,
  ariaLabel,
  children,
}: Props) {
  const recordClick = () => {
    // Never delay the purchase destination for analytics. keepalive lets this
    // finish after the new FANZA tab opens, and failures are intentionally ignored.
    void fetch("/api/affiliate-click", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workId, placement, sourcePage }),
      keepalive: true,
    }).catch(() => undefined);
  };

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className={className}
      aria-label={ariaLabel}
      onClick={recordClick}
    >
      {children}
    </a>
  );
}
