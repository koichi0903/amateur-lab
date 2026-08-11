import { fetchItems } from "@/lib/dmm/fetchItems";

export async function testSampleMovie() {
  console.log("===== Sample Movie Test =====");

  const items = await fetchItems();

  console.log(`取得件数: ${items.length}`);

  if (items.length === 0) {
    console.log("作品が取得できませんでした");
    return;
  }

  console.log("===== 1件目(JSON) =====");

console.log(
  JSON.stringify(items[0], null, 2)
);
}