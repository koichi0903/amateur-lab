import type { DmmItem } from "@/types/dmm";

import { saveDmmItem } from "./save";
import { updateWork } from "./updateWork";
import { updatePlaywrightItem } from "@/lib/playwright/updatePlaywrightItem";

export async function registerWork(
  item: DmmItem
) {
  // DMM作品登録
  await saveDmmItem(item);

  // DMM詳細更新
  await updateWork(item.content_id);

  // Playwright価格取得
  await updatePlaywrightItem(
  item.content_id,
  item.URL ?? item.affiliateURL
);
}