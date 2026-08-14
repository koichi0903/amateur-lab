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
    await updateDmmItem(dmmItem);

    const currentPrice = Number(dmmItem.prices?.price) || 0;
    const normalPrice = Number(dmmItem.prices?.list_price) || currentPrice;

    if (currentPrice > 0) {
      console.log(
        `[DMM_API_PRICE] ${productId} current=${currentPrice} list=${normalPrice}`,
      );
    }
  }

  await updatePlaywrightItem(
  productId,
  dmmItem?.URL ??
    dmmItem?.affiliateURL,
  browser,
  listPrice
);
}
