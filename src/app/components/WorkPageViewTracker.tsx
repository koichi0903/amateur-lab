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
