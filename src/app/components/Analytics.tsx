"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  isOperatorLandingPath,
  type ExternalAttribution,
  type ExternalAttributionChannel,
} from "@/lib/externalAttribution";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const ATTRIBUTION_STORAGE_KEY = "hakkutsu-lab:external-attribution:v1";
const SESSION_ATTRIBUTION_STORAGE_KEY = "hakkutsu-lab:session-attribution:v1";
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

const searchHosts = [
  "google.",
  "bing.com",
  "yahoo.",
  "duckduckgo.com",
  "baidu.com",
];

const socialHosts = [
  "x.com",
  "twitter.com",
  "facebook.com",
  "instagram.com",
  "threads.net",
  "t.co",
  "youtube.com",
  "youtu.be",
  "line.me",
];

function classifyReferrer(referrer: string): {
  channel: ExternalAttributionChannel;
  source: string;
} {
  if (!referrer) return { channel: "direct", source: "direct" };

  try {
    const url = new URL(referrer);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();

    if (host === window.location.hostname.replace(/^www\./, "").toLowerCase()) {
      return { channel: "internal", source: "internal" };
    }

    if (searchHosts.some((searchHost) => host.includes(searchHost))) {
      return { channel: "organic_search", source: host };
    }

    if (socialHosts.some((socialHost) => host === socialHost || host.endsWith(`.${socialHost}`))) {
      return { channel: "social", source: host };
    }

    return { channel: "referral", source: host };
  } catch {
    return { channel: "direct", source: "direct" };
  }
}

function currentLandingPath() {
  return `${window.location.pathname}${window.location.search}`.slice(0, 255);
}

function storeFirstPartyAttribution() {
  try {
    if (isOperatorLandingPath(window.location.pathname)) {
      window.sessionStorage.removeItem(SESSION_ATTRIBUTION_STORAGE_KEY);

      const fallback = window.localStorage.getItem(ATTRIBUTION_STORAGE_KEY);
      if (fallback) {
        const parsed = JSON.parse(fallback) as Partial<ExternalAttribution>;
        if (isOperatorLandingPath(parsed.landingPath)) {
          window.localStorage.removeItem(ATTRIBUTION_STORAGE_KEY);
        }
      }
      return;
    }

    const referrer = classifyReferrer(document.referrer);
    if (referrer.channel === "internal") return;

    const attribution: ExternalAttribution = {
      ...referrer,
      landingPath: currentLandingPath(),
    };

    const serialized = JSON.stringify(attribution);
    window.sessionStorage.setItem(SESSION_ATTRIBUTION_STORAGE_KEY, serialized);

    // Keep the latest meaningful external acquisition as a fallback when the
    // visitor opens an internal link in a new tab. Direct visits only become
    // the fallback when no previous acquisition has been recorded.
    if (
      referrer.channel !== "direct" ||
      !window.localStorage.getItem(ATTRIBUTION_STORAGE_KEY)
    ) {
      window.localStorage.setItem(ATTRIBUTION_STORAGE_KEY, serialized);
    }
  } catch {
    // Analytics storage is optional and must never affect browsing.
  }
}

export function readExternalAttribution(): ExternalAttribution | null {
  try {
    const stored =
      window.sessionStorage.getItem(SESSION_ATTRIBUTION_STORAGE_KEY) ??
      window.localStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as ExternalAttribution) : null;
  } catch {
    return null;
  }
}

export default function Analytics() {
  const pathname = usePathname();
  const [analyticsReady, setAnalyticsReady] = useState(false);

  useEffect(() => {
    storeFirstPartyAttribution();
    if (!GA_MEASUREMENT_ID) return;

    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || ((...args: unknown[]) => {
      window.dataLayer?.push(args);
    });
    window.gtag("js", new Date());
    window.gtag("config", GA_MEASUREMENT_ID, { send_page_view: false });
    setAnalyticsReady(true);
  }, []);

  useEffect(() => {
    if (!GA_MEASUREMENT_ID || !window.gtag || !analyticsReady) return;

    const search = window.location.search;
    const attribution = readExternalAttribution();
    window.gtag("event", "page_view", {
      page_path: `${pathname}${search}`,
      page_location: window.location.href,
      page_title: document.title,
      traffic_channel: attribution?.channel ?? "unknown",
      traffic_source: attribution?.source ?? "unknown",
      landing_path: attribution?.landingPath ?? "unknown",
    });
  }, [analyticsReady, pathname]);

  if (!GA_MEASUREMENT_ID) return null;

  return (
    <Script
      src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
      strategy="afterInteractive"
    />
  );
}
