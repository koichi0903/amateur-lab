import { getDmmItem } from "@/lib/dmm/getDmmItem";
import { updateDmmItem } from "./update";
import { updatePlaywrightItem } from "@/lib/playwright/updatePlaywrightItem";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import type { DmmItem } from "@/types/dmm";
import type { Browser } from "playwright-core";

type UpdateWorkOptions = {
  captureSampleMovie?: boolean;
};

export async function updateWork(
  productId: string,
  item?: DmmItem | null,
  browser?: Browser,
  listPrice?: number | null,
  options: UpdateWorkOptions = {},
): Promise<boolean> {
  const { data: currentWork, error: currentWorkError } = await supabase
    .from("works")
    .select("id,review_count,review_average,maker,series,url,release_date,actress")
    .eq("product_id", productId)
    .maybeSingle();
  if (currentWorkError) throw currentWorkError;

  let changed = false;
  const dmmItem =
    item ?? (await getDmmItem(productId));

  if (dmmItem) {
    // DMM API prices are not the source of truth. Keep its metadata update,
    // then let the FANZA listing/detail Playwright pass own every price field.
    changed = await updateDmmItem(dmmItem, currentWork ?? undefined, {
      updatePrices: false,
    }) || changed;
  }

  const playwrightResult = await updatePlaywrightItem(
  productId,
  dmmItem?.URL ??
  dmmItem?.affiliateURL,
  browser,
  listPrice,
  options,
);
  return changed || playwrightResult === "updated";
}
