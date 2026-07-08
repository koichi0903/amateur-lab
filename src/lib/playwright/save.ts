import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import type { ParsedData } from "./parser";

console.log("URL =", process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log("KEY =", !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function saveWork(
  productId: string,
  data: ParsedData
) {
  // works 更新
  await supabase
    .from("works")
    .update({
      title: data.title,
      actress: data.actress,
      maker: data.maker,
      series: data.series,
      label: data.label,
      release_date: data.releaseDate,
      product_release_date: data.productReleaseDate,
      duration: data.duration,
    })
    .eq("product_id", productId);

  // 現在の価格を取得
  const { data: currentPrices } = await supabase
    .from("work_prices")
    .select("*")
    .eq("product_id", productId);

  const currentMap = new Map(
    (currentPrices ?? []).map((price) => [
      price.display_name,
      price,
    ])
  );

  // 新しい価格を保存
  for (const price of data.prices) {
    const current = currentMap.get(price.name);

    if (!current) {
      // 新規追加
      await supabase
        .from("work_prices")
        .insert({
          product_id: productId,
          display_name: price.name,
          type: price.type,
          normal_price: price.normalPrice,
          sale_price: price.salePrice,
        });

      continue;
    }

    // 価格変更あり？
    const changed =
      current.normal_price !== price.normalPrice ||
      current.sale_price !== price.salePrice;

    if (changed) {
      // 履歴保存
      await supabase
  .from("price_history")
  .insert({
    product_id: productId,
    display_name: price.name,
    type: price.type,
    normal_price: price.normalPrice,
    sale_price: price.salePrice,
  });

      // 現在価格更新
      await supabase
        .from("work_prices")
        .update({
          type: price.type,
          normal_price: price.normalPrice,
          sale_price: price.salePrice,
        })
        .eq("id", current.id);
    }

    currentMap.delete(price.name);
  }

  // 取得できなくなった価格を削除
  for (const price of currentMap.values()) {
    await supabase
      .from("work_prices")
      .delete()
      .eq("id", price.id);
  }
}