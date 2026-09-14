"use client";

import { useEffect, useRef } from "react";
import {
  normalizeAffiliateSource,
  type AffiliateSource,
} from "@/lib/affiliateTracking";
import { readExternalAttribution } from "./Analytics";

type Props = {
  workId: number;
  sourcePage?: AffiliateSource;
  price: number | null;
  discountRate: number | null;
  discoveryScore: number | null;
  ranking: number | null;
  xPostKey?: string | null;
};

const PAGE_VIEW_STORAGE_PREFIX = "hakkutsu-lab:work-page-view:v1";
const MAX_X_POST_KEY_LENGTH = 120;

function shouldRecordPageView(key: string) {
  try {
    if (window.sessionStorage.getItem(key)) return false;
    window.sessionStorage.setItem(key, "1");
    return true;
  } catch {
    return true;
  }
}

function readUrlAttribution(fallbackSourcePage?: AffiliateSource) {
  const params = new URLSearchParams(window.location.search);
  const xPostKey =
    params.get("x_post")?.trim().slice(0, MAX_X_POST_KEY_LENGTH) || null;

  return {
    sourcePage: normalizeAffiliateSource(params.get("from") ?? fallbackSourcePage),
    xPostKey,
  };
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
    const attribution = readUrlAttribution(sourcePage);
    const storageKey = `${PAGE_VIEW_STORAGE_PREFIX}:${workId}:${attribution.sourcePage}:${attribution.xPostKey ?? xPostKey ?? ""}`;
    if (!shouldRecordPageView(storageKey)) return;

    void fetch("/api/work-page-view", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workId,
        sourcePage: attribution.sourcePage,
        price,
        discountRate,
        discoveryScore,
        ranking,
        xPostKey: attribution.xPostKey ?? xPostKey ?? null,
        externalAttribution: readExternalAttribution(),
      }),
      keepalive: true,
    }).catch(() => undefined);
  }, [discountRate, discoveryScore, price, ranking, sourcePage, workId, xPostKey]);

  return null;
}
