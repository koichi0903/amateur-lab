import type { DmmItem } from "@/types/dmm";

import { saveDmmItem } from "./save";
import { updateWork } from "./updateWork";

export async function registerWork(
  item: DmmItem
) {
  // DMM作品登録
  const saved = await saveDmmItem(item, undefined);
  if (!saved) return false;

  await updateWork(
    item.content_id,
    item,
    undefined,
    undefined,
    { captureSampleMovie: true },
  );

  return true;
}
