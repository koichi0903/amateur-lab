import type { DmmItem } from "@/types/dmm";
import type { PriceInfo } from "@/lib/playwright/parser";
import { normalizePricePeriod } from "@/lib/playwright/parser";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type ExistingPricePlan = {
  display_name: string;
  period: string | null;
};

type ApiDelivery = {
  type?: unknown;
  price?: unknown;
  list_price?: unknown;
};

export type NewWorkApiPriceMapping =
  | {
      status: "mapped";
      prices: PriceInfo[];
      saleEndAt: Date | null;
    }
  | {
      status: "fallback";
      reason: string;
    };

type DeliveryCategory = "download" | "hd" | "4k" | "8k" | "stream";

function parsePositivePrice(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const normalized = String(value).replace(/,/g, "").trim();
  if (!/^\d+$/.test(normalized)) return null;

  const price = Number(normalized);
  return Number.isSafeInteger(price) && price > 0 ? price : null;
}

function deliveriesOf(item: DmmItem): ApiDelivery[] {
  const value = item.prices?.deliveries?.delivery as unknown;
  if (Array.isArray(value)) return value as ApiDelivery[];
  return value && typeof value === "object" ? [value as ApiDelivery] : [];
}

function categoryOf(type: string): DeliveryCategory | "alias" | null {
  switch (type.trim().toLowerCase()) {
    case "download":
      return "download";
    case "hd":
      return "hd";
    case "4k":
      return "4k";
    case "8k":
      return "8k";
    case "stream":
      return "stream";
    case "iosdl":
    case "androiddl":
      return "alias";
    default:
      return null;
  }
}

function planMatchesCategory(
  category: DeliveryCategory,
  displayName: string,
): boolean {
  const name = displayName.toLowerCase().replace(/\s/g, "");
  const hasDownload = name.includes("ダウンロード");
  const hasStream = name.includes("ストリーミング");
  const hasHd = /(?:^|[^a-z])hd(?:版)?/i.test(displayName);
  const hasHq = /(?:^|[^a-z])hq(?:版)?/i.test(displayName);
  const has4k = /4\s*k/i.test(displayName);
  const has8k = /8\s*k/i.test(displayName);

  switch (category) {
    case "download":
      return hasDownload && !hasHd && !has4k && !has8k;
    case "hd":
      return (hasHd || hasHq) && hasDownload && !has4k && !has8k;
    case "4k":
      return has4k;
    case "8k":
      return has8k;
    case "stream":
      return hasStream && !hasDownload;
  }
}

function parseDmmDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const normalized = value.trim();
  const dateText = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(normalized)
    ? `${normalized.replace(" ", "T")}+09:00`
    : normalized;
  const date = new Date(dateText);
  return Number.isFinite(date.getTime()) ? date : null;
}

function getActiveCampaignEndAt(item: DmmItem, now: Date): Date | null {
  const campaigns = Array.isArray(item.campaign)
    ? item.campaign
    : item.campaign
      ? [item.campaign]
      : [];
  const activeEnds = campaigns.flatMap((campaign) => {
    const beginsAt = parseDmmDate(campaign.date_begin);
    const endsAt = parseDmmDate(campaign.date_end);
    if (!beginsAt || !endsAt || beginsAt > now || endsAt <= now) return [];
    return [endsAt];
  });

  return activeEnds.length === 1 ? activeEnds[0] : null;
}

export function mapDmmItemPricesToPlans(
  item: DmmItem,
  plans: ExistingPricePlan[],
  now: Date,
): NewWorkApiPriceMapping {
  if (plans.length === 0) {
    return { status: "fallback", reason: "既存の価格プランがない" };
  }

  const deliveries = deliveriesOf(item);
  if (deliveries.length === 0) {
    return { status: "fallback", reason: "APIに配信価格がない" };
  }

  const parsedDeliveries = deliveries.map((delivery) => {
    const type = typeof delivery.type === "string" ? delivery.type.trim().toLowerCase() : "";
    const price = parsePositivePrice(delivery.price);
    const listPrice = parsePositivePrice(delivery.list_price);
    return { type, price, listPrice, category: categoryOf(type) };
  });

  if (parsedDeliveries.some((delivery) => !delivery.type || !delivery.category)) {
    return { status: "fallback", reason: "未対応のAPI配信種別がある" };
  }

  const primaryDeliveries = parsedDeliveries.filter(
    (delivery) => delivery.category !== "alias",
  );
  const aliases = parsedDeliveries.filter(
    (delivery) => delivery.category === "alias",
  );
  const download = primaryDeliveries.find((delivery) => delivery.category === "download");

  if (
    aliases.some(
      (alias) =>
        !download ||
        alias.price == null ||
        alias.listPrice == null ||
        alias.price !== download.price ||
        alias.listPrice !== download.listPrice,
    )
  ) {
    return { status: "fallback", reason: "アプリ用価格を通常ダウンロード価格と照合できない" };
  }

  const typeCounts = new Map<string, number>();
  for (const delivery of primaryDeliveries) {
    typeCounts.set(delivery.type, (typeCounts.get(delivery.type) ?? 0) + 1);
  }
  if ([...typeCounts.values()].some((count) => count !== 1)) {
    return { status: "fallback", reason: "APIの配信種別が重複している" };
  }

  const usedPlans = new Set<number>();
  const prices: PriceInfo[] = [];

  for (const delivery of primaryDeliveries) {
    if (delivery.price == null || delivery.listPrice == null || delivery.price > delivery.listPrice) {
      return { status: "fallback", reason: "API価格が不正または不足している" };
    }

    const category = delivery.category as DeliveryCategory;
    const matches = plans
      .map((plan, index) => ({ plan, index }))
      .filter(
        ({ plan, index }) =>
          !usedPlans.has(index) &&
          normalizePricePeriod(plan.period) != null &&
          planMatchesCategory(category, plan.display_name),
      );

    if (matches.length !== 1) {
      return {
        status: "fallback",
        reason: `${delivery.type}に対応する既存プランが一意でない`,
      };
    }

    const { plan, index } = matches[0];
    const period = normalizePricePeriod(plan.period);
    if (!period) return { status: "fallback", reason: "既存プランの期間が不明" };

    usedPlans.add(index);
    prices.push({
      type: delivery.type,
      name: plan.display_name,
      period,
      normalPrice: delivery.listPrice,
      ...(delivery.price < delivery.listPrice ? { salePrice: delivery.price } : {}),
    });
  }

  if (usedPlans.size !== plans.length) {
    return { status: "fallback", reason: "APIと既存プランの件数が一致しない" };
  }

  const hasDiscount = prices.some((price) => price.salePrice != null);
  const saleEndAt = hasDiscount ? getActiveCampaignEndAt(item, now) : null;
  if (hasDiscount && !saleEndAt) {
    return { status: "fallback", reason: "割引の有効なキャンペーン期限が特定できない" };
  }

  return { status: "mapped", prices, saleEndAt };
}

export async function mapDmmItemPricesToExistingPlans(
  productId: string,
  item: DmmItem,
  now = new Date(),
): Promise<NewWorkApiPriceMapping> {
  const { data, error } = await supabaseAdmin
    .from("work_prices")
    .select("display_name,period")
    .eq("product_id", productId);

  if (error) {
    return {
      status: "fallback",
      reason: `既存プランの読込失敗: ${error.message}`,
    };
  }

  return mapDmmItemPricesToPlans(item, (data ?? []) as ExistingPricePlan[], now);
}
