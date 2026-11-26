import type { Browser } from "playwright-core";

import { getDmmItem } from "@/lib/dmm/getDmmItem";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import type { DmmItem } from "@/types/dmm";
import { updatePlaywrightItem } from "@/lib/playwright/updatePlaywrightItem";
import { saveWork } from "@/lib/playwright/save";

import { mapDmmItemPricesToExistingPlans } from "./newWorkApiPrices";
import { updateDmmItem } from "./update";
import { updateWorkDetailed } from "./updateWork";

export type ApiPriceUpdateOutcome = "updated" | "unchanged" | "incomplete";

type UpdateWorkWithApiPricesOptions = {
  captureSampleMovie?: boolean;
  logPrefix?: string;
};

function hasValidReleaseDate(value: string | null | undefined): value is string {
  const match = value?.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[ T])/);
  if (!match) return false;

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return (
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() === Number(month) - 1 &&
    date.getUTCDate() === Number(day)
  );
}

function outcomeFromPlaywright(
  result: Awaited<ReturnType<typeof updatePlaywrightItem>>,
): ApiPriceUpdateOutcome {
  if (result === "updated") return "updated";
  if (result === "unchanged") return "unchanged";
  return "incomplete";
}

async function preserveReleaseDateWhenApiOmitsIt(
  productId: string,
  item: DmmItem,
): Promise<DmmItem> {
  if (hasValidReleaseDate(item.date)) return item;

  const { data, error } = await supabase
    .from("works")
    .select("release_date")
    .eq("product_id", productId)
    .maybeSingle();
  if (error) throw error;

  return { ...item, date: data?.release_date ?? "" };
}

export async function updateWorkWithApiPrices(
  productId: string,
  browser: Browser,
  listPrice: number | null,
  options: UpdateWorkWithApiPricesOptions = {},
): Promise<ApiPriceUpdateOutcome> {
  const { captureSampleMovie = false, logPrefix = "API_PRICE" } = options;
  let item: DmmItem | null = null;

  try {
    item = await getDmmItem(productId);
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "unknown";
    console.warn(`[${logPrefix}_FALLBACK] API取得失敗 ${productId} (${errorName})`);
  }

  if (!item) {
    console.info(`[${logPrefix}_FALLBACK] ${productId}: API作品情報なし`);
    return outcomeFromPlaywright(
      await updatePlaywrightItem(productId, null, browser, listPrice, {
        captureSampleMovie,
      }),
    );
  }

  item = await preserveReleaseDateWhenApiOmitsIt(productId, item);
  const mapping = await mapDmmItemPricesToExistingPlans(productId, item);

  if (mapping.status === "fallback") {
    console.info(`[${logPrefix}_FALLBACK] ${productId}: ${mapping.reason}`);
    const result = await updateWorkDetailed(productId, item, browser, listPrice, {
      captureSampleMovie,
    });
    if (result.playwrightResult === "updated") return "updated";
    if (result.playwrightResult === "unchanged") {
      return result.status === "updated" ? "updated" : "unchanged";
    }
    return "incomplete";
  }

  if (captureSampleMovie) {
    await updatePlaywrightItem(
      productId,
      item.URL ?? item.affiliateURL,
      browser,
      listPrice,
      { sampleMovieOnly: true },
    );
  }

  const { data: currentWork, error: currentWorkError } = await supabase
    .from("works")
    .select("id,review_count,review_average,maker,series,url,release_date,actress")
    .eq("product_id", productId)
    .maybeSingle();
  if (currentWorkError) throw currentWorkError;
  if (!currentWork) throw new Error(`作品情報が見つかりません: ${productId}`);

  const metadataChanged = await updateDmmItem(item, currentWork, {
    updatePrices: false,
  });
  let priceDataChanged = false;
  let lastSaveError: unknown = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      priceDataChanged = await saveWork(
        productId,
        {
          prices: mapping.prices,
          sampleImages: [],
          saleEndAt: mapping.saleEndAt,
        },
        listPrice,
      );
      lastSaveError = null;
      break;
    } catch (error) {
      lastSaveError = error;
      console.error(`[${logPrefix}_SAVE_ERROR] (${attempt}/3) ${productId}`, error);
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
  }

  if (lastSaveError) throw lastSaveError;

  console.log(
    `[${logPrefix}_OK] ${productId} plans=${mapping.prices.length} source=DMM_API`,
  );
  return metadataChanged || priceDataChanged ? "updated" : "unchanged";
}
