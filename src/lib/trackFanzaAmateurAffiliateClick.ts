type AmateurAffiliatePlacement = "listing-card" | "detail-sidebar";
type AmateurSourcePage = "amateur" | "amateur_detail";

export function trackFanzaAmateurAffiliateClick({
  contentId,
  sourcePage,
  placement,
}: {
  contentId: string;
  sourcePage: AmateurSourcePage;
  placement: AmateurAffiliatePlacement;
}) {
  window.gtag?.("event", "amateur_affiliate_click", {
    content_id: contentId,
    source_page: sourcePage,
    affiliate_id: "991",
    placement,
  });

  // Keep the destination click responsive even if measurement is unavailable.
  void fetch("/api/amateur-affiliate-click", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contentId, sourcePage, placement }),
    keepalive: true,
  }).catch(() => undefined);
}
