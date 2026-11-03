export type AmateurAffiliateClickEvent = {
  contentId: string;
  sourcePage: "amateur" | "amateur_detail";
  placement: "listing-card" | "detail-sidebar";
};

const sourcePages = new Set<AmateurAffiliateClickEvent["sourcePage"]>([
  "amateur",
  "amateur_detail",
]);
const placements = new Set<AmateurAffiliateClickEvent["placement"]>([
  "listing-card",
  "detail-sidebar",
]);
const contentIdPattern = /^[A-Za-z0-9._-]{1,120}$/;

export function parseAmateurAffiliateClickPayload(
  payload: unknown,
): AmateurAffiliateClickEvent | null {
  if (typeof payload !== "object" || payload === null) return null;

  const value = payload as Record<string, unknown>;
  const contentId = typeof value.contentId === "string" ? value.contentId.trim() : "";
  const sourcePage = typeof value.sourcePage === "string" ? value.sourcePage : "";
  const placement = typeof value.placement === "string" ? value.placement : "";

  if (
    !contentIdPattern.test(contentId) ||
    !sourcePages.has(sourcePage as AmateurAffiliateClickEvent["sourcePage"]) ||
    !placements.has(placement as AmateurAffiliateClickEvent["placement"])
  ) {
    return null;
  }

  return {
    contentId,
    sourcePage: sourcePage as AmateurAffiliateClickEvent["sourcePage"],
    placement: placement as AmateurAffiliateClickEvent["placement"],
  };
}
