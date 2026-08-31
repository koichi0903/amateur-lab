"use client";

import { useEffect, useRef } from "react";
import type { AffiliateSource } from "@/lib/affiliateTracking";
import { readExternalAttribution } from "./Analytics";

type Props = {
  workId: number;
  sourcePage: AffiliateSource;
  price: number | null;
  discountRate: number | null;
  discoveryScore: number | null;
  ranking: number | null;
  xPostKey?: string | null;
};

const PAGE_VIEW_STORAGE_PREFIX = "hakkutsu-lab:work-page-view:v1";

function shouldRecordPageView(key: string) {
  try {
    if (window.sessionStorage.getItem(key)) return false;
    window.sessionStorage.setItem(key, "1");
    return true;
  } catch {
    return true;
  }
}

export default function WorkPageViewTracker({
  workId,
  sourcePage,
  price,
  discountRate,
  discoveryScore,
  ranking,
  xPostKey,
}: Props) {
  const sentRef = useRef(false);

  useEffect(() => {
    if (sentRef.current) return;
    sentRef.current = true;
    const storageKey = `${PAGE_VIEW_STORAGE_PREFIX}:${workId}:${sourcePage}:${xPostKey ?? ""}`;
    if (!shouldRecordPageView(storageKey)) return;

    void fetch("/api/work-page-view", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workId,
        sourcePage,
        price,
        discountRate,
        discoveryScore,
        ranking,
        xPostKey,
        externalAttribution: readExternalAttribution(),
      }),
      keepalive: true,
    }).catch(() => undefined);
  }, [discountRate, discoveryScore, price, ranking, sourcePage, workId, xPostKey]);

  return null;
}
