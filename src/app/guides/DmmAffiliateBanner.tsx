"use client";

import { useEffect, useRef } from "react";

const BANNER_SCRIPT_URL = "https://widget-view.dmm.co.jp/js/banner_placement.js?affiliate_id=koichi1928-026&banner_id=1277_300_250";

export default function DmmAffiliateBanner() {
  const bannerRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    const banner = bannerRef.current;
    if (!banner) return;

    const script = document.createElement("script");
    script.className = "widget-banner-script";
    script.src = BANNER_SCRIPT_URL;
    banner.insertAdjacentElement("afterend", script);

    return () => {
      script.remove();
      banner.replaceChildren();
    };
  }, []);

  return <ins ref={bannerRef} className="widget-banner" />;
}
