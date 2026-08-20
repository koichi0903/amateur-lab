"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import type {
  ExternalAttribution,
  ExternalAttributionChannel,
} from "@/lib/externalAttribution";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const ATTRIBUTION_STORAGE_KEY = "hakkutsu-lab:external-attribution:v1";
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
    if (window.localStorage.getItem(ATTRIBUTION_STORAGE_KEY)) return;

    const referrer = classifyReferrer(document.referrer);
    if (referrer.channel === "internal") return;

    const attribution: ExternalAttribution = {
      ...referrer,
      landingPath: currentLandingPath(),
    };

    window.localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(attribution));
  } catch {
    // Analytics storage is optional and must never affect browsing.
  }
}

export function readExternalAttribution(): ExternalAttribution | null {
  try {
    const stored = window.localStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as ExternalAttribution) : null;
  } catch {
    return null;
  }
}

export default function Analytics() {
  const pathname = usePathname();

  useEffect(() => {
    storeFirstPartyAttribution();
  }, []);

  useEffect(() => {
    if (!GA_MEASUREMENT_ID || !window.gtag) return;

    const search = window.location.search;
    window.gtag("config", GA_MEASUREMENT_ID, {
      page_path: `${pathname}${search}`,
    });
  }, [pathname]);

  if (!GA_MEASUREMENT_ID) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}', { send_page_view: false });
        `}
      </Script>
    </>
  );
}
