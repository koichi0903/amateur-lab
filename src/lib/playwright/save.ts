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

  // work_prices は一旦全削除
  await supabase
    .from("work_prices")
    .delete()
    .eq("product_id", productId);

  // 3価格を保存
  if (data.prices.length > 0) {
    await supabase
      .from("work_prices")
      .insert(
        data.prices.map((price) => ({
          product_id: productId,
          display_name: price.name,
          type: price.type,
          normal_price: price.normalPrice,
          sale_price: price.salePrice,
        }))
      );
  }
}