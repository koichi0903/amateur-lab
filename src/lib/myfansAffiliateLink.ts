import type { MyfansProduct } from "@/lib/myfansAnalytics";

export type MyfansAffiliateLinkStatus = "missing" | "valid" | "expiring_soon" | "expired";

export const MYFANS_AFFILIATE_URL_SOURCE_MANUAL = "daily_card_manual";
export const MYFANS_CLICK_ATTRIBUTION_WINDOW_HOURS = 24;

export function isValidMyfansAffiliateUrl(value: string | null | undefined) {
  return /^https:\/\/mfco\.link\/r\/[A-Za-z0-9_-]+(?:[/?#].*)?$/.test(String(value ?? "").trim());
}

export function normalizeMyfansAffiliateUrl(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim();
  return isValidMyfansAffiliateUrl(trimmed) ? trimmed : "";
}

export function myfansAffiliateLinkStatus(product: Pick<MyfansProduct, "affiliate_url" | "affiliate_url_expires_at">, now = new Date()): MyfansAffiliateLinkStatus {
  if (!isValidMyfansAffiliateUrl(product.affiliate_url)) return "missing";
  if (!product.affiliate_url_expires_at) return "valid";
  const expiresAt = new Date(product.affiliate_url_expires_at).getTime();
  if (!Number.isFinite(expiresAt)) return "valid";
  const remainingMs = expiresAt - now.getTime();
  if (remainingMs <= 0) return "expired";
  return remainingMs < 24 * 60 * 60 * 1000 ? "expiring_soon" : "valid";
}

export function myfansAffiliateLinkStatusLabel(status: MyfansAffiliateLinkStatus) {
  if (status === "missing") return "リンク未作成";
  if (status === "expiring_soon") return "残り24時間未満";
  if (status === "expired") return "期限切れ";
  return "有効";
}
