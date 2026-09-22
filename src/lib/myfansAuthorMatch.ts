export type MyfansCreatorAuthorEvidence = {
  id: number;
  creator_x_url?: string | null;
  source_x_handle?: string | null;
};

export type MyfansProductLinkEvidence = {
  id: number;
  creator_id?: number | null;
  quote_candidate_x_url?: string | null;
};

function text(value: unknown) {
  return String(value ?? "").normalize("NFKC").trim();
}

/** Canonical handle used only for exact author identity checks. */
export function canonicalMyfansXHandle(value: unknown) {
  const raw = text(value).replace(/^@/, "");
  if (!raw) return "";
  const profile = raw.match(/^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/([^/?#]+)\/?(?:[?#].*)?$/i);
  const handle = profile?.[1] ?? raw.split(/[/?#]/, 1)[0];
  return /^[A-Za-z0-9_]{1,15}$/.test(handle) ? handle.toLowerCase() : "";
}

export function exactMyfansCreatorIds(creators: MyfansCreatorAuthorEvidence[], observedHandle: unknown) {
  const canonicalObserved = canonicalMyfansXHandle(observedHandle);
  if (!canonicalObserved) return [];
  return [...new Set(creators
    .filter((creator) => [creator.creator_x_url, creator.source_x_handle].some((value) => canonicalMyfansXHandle(value) === canonicalObserved))
    .map((creator) => creator.id))];
}

export function resolveExactMyfansCreator(creators: MyfansCreatorAuthorEvidence[], observedHandle: unknown) {
  const ids = exactMyfansCreatorIds(creators, observedHandle);
  return ids.length === 1 ? { creatorId: ids[0], status: "exact" as const } : { creatorId: null, status: ids.length > 1 ? "ambiguous" as const : "unresolved" as const };
}

export function resolveExactMyfansProductId(products: MyfansProductLinkEvidence[], creatorId: number, statusUrl: unknown, existingProductId?: number | null) {
  const exactStatusUrl = String(statusUrl ?? "").trim().replace(/\?.*$/, "").replace(/#.*$/, "");
  const existing = existingProductId ? products.find((product) => product.id === existingProductId && product.creator_id === creatorId) : null;
  if (existing) return existing.id;
  return products.find((product) => product.creator_id === creatorId && String(product.quote_candidate_x_url ?? "").trim().replace(/\?.*$/, "").replace(/#.*$/, "") === exactStatusUrl)?.id ?? null;
}
