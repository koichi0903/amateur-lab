import { X_GROWTH_ACCOUNT } from "@/lib/xMediaAssets";
import { withXPostTracking } from "@/lib/xPostTracking";
import type { XGrowthOpportunity } from "@/lib/xGrowthOS";
export const ACCOUNT = X_GROWTH_ACCOUNT;

export function todayTokyo() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function withXPostTrackingText(text: string | null | undefined, postKey: string) {
  if (!text) return text ?? null;
  return text.replace(/https?:\/\/[^\s<>]+/g, (url) => withXPostTracking(url, postKey) ?? url);
}

export function scoreBreakdown(item: XGrowthOpportunity) {
  return {
    reach: item.reachScore,
    follow: item.followScore,
    authority: item.authorityScore,
    revenue: item.revenueScore,
    creative_quality: item.creativeVariants?.map((variant) => ({
      id: variant.id,
      intent: variant.intent,
      total: variant.quality.total,
      passed: variant.quality.passed,
      dimensions: variant.quality.dimensions,
      gate: variant.quality.gate,
    })) ?? [],
  };
}

export function isMissingRelation(error: { code?: string; message?: string } | null | undefined) {
  return error?.code === "42P01" || error?.code === "42703" || error?.message?.includes("Could not find") || error?.message?.includes("schema cache");
}
