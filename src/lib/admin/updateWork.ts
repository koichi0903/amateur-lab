import { getDmmItem } from "@/lib/dmm/getDmmItem";
import { updateDmmItem } from "./update";
import { updatePlaywrightItem } from "@/lib/playwright/updatePlaywrightItem";

export async function updateWork(
  productId: string
) {
  const item = await getDmmItem(productId);

  if (item) {
    await updateDmmItem(item);
  }

  await updatePlaywrightItem(productId);
}