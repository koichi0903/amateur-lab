import { getDmmItem } from "@/lib/dmm/getDmmItem";
import { updateDmmItem } from "./update";
import { updatePlaywrightItem } from "@/lib/playwright/updatePlaywrightItem";
import type { DmmItem } from "@/types/dmm";
import type { Browser } from "playwright-core";

export async function updateWork(
  productId: string,
  item?: DmmItem | null,
  browser?: Browser,
  listPrice?: number | null
)
{
  const dmmItem =
    item ?? (await getDmmItem(productId));

  if (dmmItem) {
    // DMM API prices are not the source of truth. Keep its metadata update,
    // then let the FANZA listing/detail Playwright pass own every price field.
    await updateDmmItem(dmmItem, undefined, { updatePrices: false });
  }

  await updatePlaywrightItem(
  productId,
  dmmItem?.URL ??
  dmmItem?.affiliateURL,
  browser,
  listPrice
);
}
