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

  // ------------------------
// サイトで表示する代表価格
// ------------------------

// ------------------------
// サイトで表示する代表価格
// （最安の通常価格）
// ------------------------

const mainPrice =
  data.prices
    .filter(
      (p) => p.normalPrice != null
    )
    .sort(
      (a, b) =>
        a.normalPrice! - b.normalPrice!
    )[0];

// ------------------------
// 底値判定（7日間レンタル）
// ------------------------

const rentalPrice = data.prices.find(
  (p) =>
    p.period?.includes("7日") &&
    p.normalPrice != null
);

const isBottomPrice =
  (rentalPrice?.normalPrice ?? Infinity) <= 300;

const price =
  mainPrice?.normalPrice ??
  mainPrice?.salePrice ??
  null;

let salePrice: number | null = null;

let discountRate = 0;

let isOnSale = false;

let saleEndAt: Date | null = null;

// セール中
if (
  data.saleEndAt &&
  mainPrice?.salePrice &&
  mainPrice.normalPrice &&
  mainPrice.salePrice < mainPrice.normalPrice
) {
  salePrice = mainPrice.salePrice;

  discountRate = Math.round(
    ((mainPrice.normalPrice -
      mainPrice.salePrice) /
      mainPrice.normalPrice) *
      100
  );

  isOnSale = true;

  saleEndAt = data.saleEndAt;
}

  // works 更新
  const { data: updated, error } = await supabase
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

    price,

    sale_price: salePrice,

    discount_rate: discountRate,

    is_on_sale: isOnSale,

    sale_end_at: saleEndAt,

    updated_at: new Date().toISOString(),

    is_bottom_price: isBottomPrice,
  })
  .eq("product_id", productId)
  .select();

console.log("price =", price);
console.log("updated =", updated);

if (error) {
  console.error("UPDATE ERROR", error);
}

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