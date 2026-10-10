"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  isOperatorLandingPath,
  type ExternalAttribution,
  type ExternalAttributionChannel,
} from "@/lib/externalAttribution";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    __hakkutsuGaInitialized?: boolean;
  }
}

const ATTRIBUTION_STORAGE_KEY = "hakkutsu-lab:external-attribution:v1";
const SESSION_ATTRIBUTION_STORAGE_KEY = "hakkutsu-lab:session-attribution:v1";
const SESSION_X_POST_KEY = "hakkutsu-lab:session-x-post:v1";
const MAX_X_POST_KEY_LENGTH = 120;
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const GA_SCRIPT_ID = "hakkutsu-google-analytics";

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
  const params = new URLSearchParams(window.location.search);
  // Keep the post key in session storage instead of the long-lived fallback.
  params.delete("x_post");
  const search = params.toString();
  return `${window.location.pathname}${search ? `?${search}` : ""}`.slice(0, 255);
}

function currentXPostKey() {
  return new URLSearchParams(window.location.search)
    .get("x_post")
    ?.trim()
    .slice(0, MAX_X_POST_KEY_LENGTH) || null;
}

function storeFirstPartyAttribution(isInitialPageLoad: boolean) {
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
    const urlXPostKey = currentXPostKey();
    if (urlXPostKey) {
      window.sessionStorage.setItem(SESSION_X_POST_KEY, urlXPostKey);
    } else if (isInitialPageLoad && referrer.channel !== "internal") {
      // A fresh external/direct landing starts a new acquisition. Internal
      // navigation and reloads retain the current session's X post key.
      window.sessionStorage.removeItem(SESSION_X_POST_KEY);
    }

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

export function readXPostKey(): string | null {
  try {
    return currentXPostKey() ?? window.sessionStorage.getItem(SESSION_X_POST_KEY);
  } catch {
    return currentXPostKey();
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

export function trackWorkSelection({
  workId,
  title,
  itemListName,
  index,
}: {
  workId: number;
  title: string;
  itemListName: string;
  index?: number;
}) {
  window.gtag?.("event", "select_item", {
    item_list_name: itemListName,
    source_page: window.location.pathname,
    page_path: `${window.location.pathname}${window.location.search}`,
    x_post_key: readXPostKey() ?? "unknown",
    items: [{
      item_id: String(workId),
      item_name: title,
      index,
    }],
    transport_type: "beacon",
  });
}

export default function Analytics() {
  const pathname = usePathname();
  const [analyticsReady, setAnalyticsReady] = useState(false);
  const initializedPageRef = useRef(false);

  useEffect(() => {
    if (pathname.startsWith("/admin")) {
      try {
        window.sessionStorage.removeItem(SESSION_X_POST_KEY);
      } catch {
        // Session storage is optional and must not affect admin navigation.
      }
      return;
    }
    storeFirstPartyAttribution(!initializedPageRef.current);
    initializedPageRef.current = true;
    if (!GA_MEASUREMENT_ID) return;

    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag() {
      // gtag.js consumes Arguments objects from dataLayer, as in Google's snippet.
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer?.push(arguments);
    };
    if (!window.__hakkutsuGaInitialized) {
      window.gtag("js", new Date());
      window.gtag("config", GA_MEASUREMENT_ID, { send_page_view: false });
      window.__hakkutsuGaInitialized = true;
    }

    // Queue the GA config before loading gtag.js. Loading it through next/script
    // in parallel with this effect can let the library arrive before the queue
    // exists, which silently loses the initial page view on fast connections.
    if (!document.getElementById(GA_SCRIPT_ID)) {
      const script = document.createElement("script");
      script.id = GA_SCRIPT_ID;
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
      document.head.appendChild(script);
    }

    setAnalyticsReady(true);
  }, [pathname]);

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
      x_post_key: readXPostKey() ?? "unknown",
    });
  }, [analyticsReady, pathname]);

  return null;
}
