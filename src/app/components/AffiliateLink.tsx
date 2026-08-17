"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { AffiliateSource } from "@/lib/affiliateTracking";
import {
  normalizeCtaVariant,
  type CtaVariant,
} from "@/lib/ctaExperiment";

export type AffiliatePlacement = "detail-sidebar" | "mobile-sticky" | "compare-card";

type Props = {
  href: string;
  workId: number;
  placement: AffiliatePlacement;
  sourcePage: AffiliateSource;
  className?: string;
  ariaLabel?: string;
  children: ReactNode;
  variantChildren?: Partial<Record<CtaVariant, ReactNode>>;
  experiment?: boolean;
};

const STORAGE_PREFIX = "hakkutsu-lab:cta-variant:v1";

function getStoredVariant(placement: AffiliatePlacement): CtaVariant {
  if (typeof window === "undefined") return "control";
  try {
    const key = `${STORAGE_PREFIX}:${placement}`;
    const stored = window.localStorage.getItem(key);
    if (stored) return normalizeCtaVariant(stored);

    const variant: CtaVariant = Math.random() < 0.5 ? "control" : "price-focus";
    window.localStorage.setItem(key, variant);
    return variant;
  } catch {
    return Math.random() < 0.5 ? "control" : "price-focus";
  }
}

export default function AffiliateLink({
  href,
  workId,
  placement,
  sourcePage,
  className,
  ariaLabel,
  children,
  variantChildren,
  experiment = false,
}: Props) {
  const [ctaVariant, setCtaVariant] = useState<CtaVariant | null>(null);
  const linkRef = useRef<HTMLAnchorElement>(null);
  const impressionRecordedRef = useRef(false);

  useEffect(() => {
    if (experiment) setCtaVariant(getStoredVariant(placement));
    else setCtaVariant("control");
  }, [experiment, placement]);

  useEffect(() => {
    impressionRecordedRef.current = false;
  }, [placement, sourcePage, workId]);

  useEffect(() => {
    if (!experiment || !ctaVariant || impressionRecordedRef.current) return;

    const link = linkRef.current;
    if (!link) return;

    const recordImpression = () => {
      if (impressionRecordedRef.current) return;
      impressionRecordedRef.current = true;
      void fetch("/api/affiliate-impression", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workId, placement, sourcePage, ctaVariant }),
        keepalive: true,
      }).catch(() => undefined);
    };

    if (!("IntersectionObserver" in window)) {
      recordImpression();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5)) {
          recordImpression();
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(link);
    return () => observer.disconnect();
  }, [ctaVariant, experiment, placement, sourcePage, workId]);

  const activeVariant = ctaVariant ?? "control";

  const recordClick = () => {
    // Never delay the purchase destination for analytics. keepalive lets this
    // finish after the new FANZA tab opens, and failures are intentionally ignored.
    void fetch("/api/affiliate-click", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workId, placement, sourcePage, ctaVariant: activeVariant }),
      keepalive: true,
    }).catch(() => undefined);
  };

  return (
    <a
      ref={linkRef}
      href={href}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className={className}
      aria-label={ariaLabel}
      onClick={recordClick}
    >
      {variantChildren?.[activeVariant] ?? children}
    </a>
  );
}
