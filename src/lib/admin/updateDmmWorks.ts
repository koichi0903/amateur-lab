import { fetchItems } from "@/lib/dmm/fetchItems";
import { updateDmmItem } from "./update";

export async function updateDmmWorks() {
  console.log("===== DMM同期開始 =====");

  const items = await fetchItems();

  console.log(
    `DMM同期対象: ${items.length}件`
  );

  let updated = 0;

  for (const item of items) {
    await updateDmmItem(item);
    updated++;
  }

  console.log(
    `DMM同期完了: ${updated}件`
  );
}