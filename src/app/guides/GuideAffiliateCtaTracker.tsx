"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { readExternalAttribution } from "@/app/components/Analytics";

const GUIDE_SLUG = "fanza-subscription-guide";
const CTA_ID = "fanza-tv-official-banner";
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content"] as const;

type GuideCtaEventName = "guide_cta_view" | "guide_affiliate_click";

function buildEventParams(): Record<string, string> {
  const attribution = readExternalAttribution();
  const params: Record<string, string> = {
    guide_slug: GUIDE_SLUG,
    cta_id: CTA_ID,
    page_path: window.location.pathname + window.location.search,
    transport_type: "beacon",
  };

  if (attribution?.channel) params.traffic_channel = attribution.channel;
  if (attribution?.source) params.traffic_source = attribution.source;
  if (attribution?.landingPath) params.landing_path = attribution.landingPath;

  const currentParams = new URLSearchParams(window.location.search);
  let landingParams: URLSearchParams | null = null;

  if (attribution?.landingPath) {
    try {
      landingParams = new URL(attribution.landingPath, window.location.origin).searchParams;
    } catch {
      // Invalid stored attribution is optional and must not affect the link.
    }
  }

  for (const key of UTM_KEYS) {
    const value = (currentParams.get(key) ?? landingParams?.get(key) ?? "").trim();
    if (value) params[key] = value.slice(0, 100);
  }

  return params;
}

function sendGuideCtaEvent(eventName: GuideCtaEventName) {
  if (typeof window.gtag !== "function") return false;
  window.gtag("event", eventName, buildEventParams());
  return true;
}

export default function GuideAffiliateCtaTracker({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const viewSentRef = useRef(false);

  useEffect(() => {
    const root = rootRef.current;
    const banner = root?.querySelector("ins.widget-banner");
    if (!root || !banner) return;

    let anchor: HTMLAnchorElement | null = null;
    let image: HTMLImageElement | null = null;
    let intersectionObserver: IntersectionObserver | null = null;
    let viewTimer: number | null = null;
    let isViewable = false;

    const clearViewTimer = () => {
      if (viewTimer !== null) window.clearTimeout(viewTimer);
      viewTimer = null;
    };

    const observeVisibleAnchor = (candidate: HTMLAnchorElement) => {
      const candidateImage = candidate.querySelector("img");
      if (candidateImage && (!candidateImage.complete || candidateImage.naturalWidth === 0)) {
        if (image !== candidateImage) {
          image = candidateImage;
          candidateImage.addEventListener(
            "load",
            () => observeVisibleAnchor(candidate),
            { once: true },
          );
        }
        return;
      }

      anchor = candidate;
      intersectionObserver?.disconnect();
      intersectionObserver = new IntersectionObserver((entries) => {
        const entry = entries.find((item) => item.target === candidate);
        if (!entry) return;

        isViewable =
          document.visibilityState === "visible" &&
          entry.isIntersecting &&
          entry.intersectionRatio >= 0.5;

        clearViewTimer();
        if (!isViewable || viewSentRef.current) return;

        viewTimer = window.setTimeout(() => {
          if (
            isViewable &&
            candidate.isConnected &&
            document.visibilityState === "visible" &&
            sendGuideCtaEvent("guide_cta_view")
          ) {
            viewSentRef.current = true;
          }
          viewTimer = null;
        }, 1000);
      }, { threshold: [0, 0.5] });
      intersectionObserver.observe(candidate);
    };

    const findBannerAnchor = () => {
      const candidate = banner.querySelector("a[href]");
      if (!(candidate instanceof HTMLAnchorElement)) return;
      if (candidate === anchor && intersectionObserver) return;
      observeVisibleAnchor(candidate);
    };

    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const clickedAnchor = target.closest("a[href]");
      if (clickedAnchor && banner.contains(clickedAnchor)) {
        sendGuideCtaEvent("guide_affiliate_click");
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        isViewable = false;
        clearViewTimer();
      } else if (anchor && intersectionObserver) {
        intersectionObserver.unobserve(anchor);
        intersectionObserver.observe(anchor);
      }
    };

    const mutationObserver = new MutationObserver(findBannerAnchor);
    mutationObserver.observe(banner, { childList: true, subtree: true, attributes: true });
    root.addEventListener("click", handleClick, true);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    findBannerAnchor();

    return () => {
      clearViewTimer();
      mutationObserver.disconnect();
      intersectionObserver?.disconnect();
      root.removeEventListener("click", handleClick, true);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return <div ref={rootRef}>{children}</div>;
}

