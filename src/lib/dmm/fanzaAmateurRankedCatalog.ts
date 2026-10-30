import "server-only";

import { unstable_cache } from "next/cache";
import { buildFanzaAmateurAffiliateUrl, getFanzaAmateurAffiliateId } from "@/lib/dmm/fanzaAmateurAffiliate";
import { FANZA_AMATEUR_FLOOR } from "@/lib/dmm/fanzaAmateurCatalogConstants";
import { hasActiveCampaign } from "@/lib/dmm/fanzaAmateurCatalogBrowseRules";
import {
  normalizeFanzaAmateurCatalogItem,
  type FanzaAmateurCatalogItem,
} from "@/lib/dmm/fanzaAmateurCatalogNormalize";

const RANKED_CATALOG_SCAN_SIZE = 5_000;
const RANKED_CATALOG_PAGE_SIZE = 100;
const AMATEUR_API_ROOT = "https://api.dmm.com/affiliate/v3/ItemList";

const getDmmFanzaAmateurRankedCatalogPage = unstable_cache(async (offset: number) => {
  const apiId = process.env.DMM_API_ID?.trim();
  if (!apiId) throw new Error("DMM API IDが設定されていません。");

  const params = new URLSearchParams({
    api_id: apiId,
    affiliate_id: getFanzaAmateurAffiliateId(),
    site: "FANZA",
    service: "digital",
    floor: FANZA_AMATEUR_FLOOR,
    hits: String(RANKED_CATALOG_PAGE_SIZE),
    offset: String(offset),
    sort: "rank",
    output: "json",
  });
  const response = await fetch(AMATEUR_API_ROOT + "?" + params.toString(), {
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const payload = await response.json().catch(() => ({})) as { result?: { status?: number | string; items?: unknown } };
  if (!response.ok || String(payload.result?.status ?? "200") !== "200" || !Array.isArray(payload.result?.items)) {
    throw new Error("DMM APIの素人ランキング取得に失敗しました（HTTP " + response.status + "）。");
  }

  return payload.result.items
    .map((rawItem) => normalizeFanzaAmateurCatalogItem(rawItem, buildFanzaAmateurAffiliateUrl))
    .filter((item): item is FanzaAmateurCatalogItem => item !== null);
}, ["fanza-amateur-ranked-catalog-page-v1"], { revalidate: 21_600, tags: ["fanza-amateur-home", "fanza-amateur-catalog"] });

async function getDmmFanzaAmateurRankedCatalog(scanSize = RANKED_CATALOG_SCAN_SIZE) {
  const items: FanzaAmateurCatalogItem[] = [];
  const pagesPerBatch = 5;
  const batchSize = RANKED_CATALOG_PAGE_SIZE * pagesPerBatch;

  for (let batchOffset = 1; batchOffset <= scanSize; batchOffset += batchSize) {
    const offsets = Array.from(
      { length: Math.min(pagesPerBatch, Math.ceil((scanSize - batchOffset + 1) / RANKED_CATALOG_PAGE_SIZE)) },
      (_, index) => batchOffset + index * RANKED_CATALOG_PAGE_SIZE,
    );
    const pages = await Promise.all(offsets.map((offset) => getDmmFanzaAmateurRankedCatalogPage(offset)));
    for (const page of pages) items.push(...page);
    if (pages.some((page) => page.length < RANKED_CATALOG_PAGE_SIZE)) break;
  }

  return items.slice(0, scanSize);
}

/** DMM popularity order, bounded for the manual X-posting queue. */
export async function getDmmFanzaAmateurPopularWorks(limit = 500) {
  const boundedLimit = Math.max(1, Math.min(500, Math.trunc(limit)));
  const items: FanzaAmateurCatalogItem[] = [];
  const seenContentIds = new Set<string>();
  for (let offset = 1; offset <= boundedLimit; offset += RANKED_CATALOG_PAGE_SIZE) {
    const pageItems = await getDmmFanzaAmateurRankedCatalogPage(offset);
    for (const item of pageItems) {
      if (seenContentIds.has(item.content_id)) continue;
      seenContentIds.add(item.content_id);
      items.push(item);
      if (items.length >= boundedLimit) return items;
    }
    if (pageItems.length < RANKED_CATALOG_PAGE_SIZE) break;
  }
  return items;
}

async function getDmmFanzaAmateurRankedCatalogWithCampaigns(targetCampaignCount: number, now: number) {
  const items: FanzaAmateurCatalogItem[] = [];
  const seenContentIds = new Set<string>();
  let activeCampaignCount = 0;

  for (let offset = 1; offset <= RANKED_CATALOG_SCAN_SIZE; offset += RANKED_CATALOG_PAGE_SIZE) {
    const page = await getDmmFanzaAmateurRankedCatalogPage(offset);
    for (const item of page) {
      if (seenContentIds.has(item.content_id)) continue;
      seenContentIds.add(item.content_id);
      items.push(item);
      if (hasActiveCampaign(item, now)) activeCampaignCount += 1;
    }

    if (activeCampaignCount >= targetCampaignCount || page.length < RANKED_CATALOG_PAGE_SIZE) break;
  }

  return items;
}

export { getDmmFanzaAmateurRankedCatalog, getDmmFanzaAmateurRankedCatalogWithCampaigns };
