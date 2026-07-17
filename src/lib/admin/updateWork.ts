import { getDmmItem } from "@/lib/dmm/getDmmItem";
import { updateDmmItem } from "./update";
import { updatePlaywrightItem } from "@/lib/playwright/updatePlaywrightItem";
import type { DmmItem } from "@/types/dmm";
import type { Browser } from "playwright";

export async function updateWork(
  productId: string,
  item?: DmmItem | null,
  browser?: Browser
)
{
  const dmmItem =
    item ?? (await getDmmItem(productId));

  if (dmmItem) {
    await updateDmmItem(dmmItem);
  }

  await updatePlaywrightItem(
  productId,
  dmmItem?.URL ??
    dmmItem?.affiliateURL,
  browser
);
}