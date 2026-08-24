import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import type { ParsedData } from "./parser";
import { generateAndSaveInsight } from "@/lib/insights/generateAndSave";
import { saveLowestPriceEvent } from "@/lib/insights/event";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "saveWork requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
  );
}

// saveWork は管理ジョブ専用。anon key では RLS により更新が0件になる場合がある。
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function saveWork(
  productId: string,
  data: ParsedData,
  listPrice?: number | null
) {

  const duplicatedPriceNames = data.prices
    .map((price) => `${price.name}\u0000${price.period ?? ""}`)
    .filter((name, index, names) => names.indexOf(name) !== index);

  if (duplicatedPriceNames.length > 0) {
    throw new Error(
      `work_prices保存前重複 (${productId}): ${[
        ...new Set(duplicatedPriceNames),
      ].join(", ")}`
    );
  }

  const getPriceKind = (price: ParsedData["prices"][number]) =>
    price.salePrice != null &&
    price.normalPrice != null &&
    price.salePrice > 0 &&
    price.salePrice < price.normalPrice
      ? "sale"
      : "regular";

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

// 表示用（代表価格の割引率）
let discountRate = 0;

// スコア用（全プラン中の最大割引率）
let maxDiscountRate = 0;

let isOnSale = false;

let saleEndAt: Date | null = null;

// セール中
// 全プラン中の最大割引率を計算（スコア用）
for (const p of data.prices) {
  if (
    p.normalPrice != null &&
    p.salePrice != null &&
    p.salePrice < p.normalPrice
  ) {
    const rate = Math.round(
      ((p.normalPrice - p.salePrice) /
        p.normalPrice) *
        100
    );

    if (rate > maxDiscountRate) {
      maxDiscountRate = rate;
    }
  }
}

// 代表価格のセール情報（表示用）
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

const { data: currentWork, error: currentError } =
  await supabase
    .from("works")
    .select(`
  price,
  list_price,
  sale_price,
  lowest_price,
  discount_rate,
  max_discount_rate,
  is_on_sale,
  sale_end_at,
  playwright_status,
  stage,
  is_bottom_price,
  actress
`)
    .eq("product_id", productId)
    .single();

if (currentError) {
  console.error(currentError);
}

const currentDisplayPrice = salePrice ?? price;

const lowestPrice =
  currentDisplayPrice == null
    ? currentWork?.lowest_price ?? null
    : currentWork?.lowest_price == null
      ? currentDisplayPrice
      : Math.min(currentWork.lowest_price, currentDisplayPrice);

const isNewLowestPrice =
  currentDisplayPrice != null &&
  (
    currentWork?.lowest_price == null ||
    currentDisplayPrice < currentWork.lowest_price
  );

const fallbackActress =
  !currentWork?.actress && data.actressLinks?.length
    ? data.actressLinks.join(" / ")
    : null;

const discontinuedStageMatch = currentWork?.playwright_status?.match(
  /^DISCONTINUED_[0-9]{8}_(RESERVED|NEW|SEMI_NEW|OLD)$/,
);
const restoredStage =
  currentWork?.stage === "DISCONTINUED"
    ? discontinuedStageMatch?.[1] ?? "OLD"
    : null;

const workUpdate = {
  title: data.title,
  ...(fallbackActress
    ? { actress: fallbackActress }
    : {}),
  maker: data.maker,
  series: data.series,
  label: data.label,

  sample_movie_url: data.sampleMovieUrl,

  release_date: data.releaseDate,
  product_release_date: data.productReleaseDate,

  duration: data.duration,

  price,

...(listPrice !== undefined
  ? { list_price: listPrice }
  : {}),

sale_price: salePrice,
lowest_price: lowestPrice,

  discount_rate: discountRate,
max_discount_rate: maxDiscountRate,

  is_on_sale: isOnSale,

  sale_end_at: saleEndAt,

  playwright_status: isOnSale
    ? "SALE"
    : "NORMAL",

  ...(restoredStage ? { stage: restoredStage } : {}),

  is_bottom_price: isBottomPrice,
};

  let updated = null;
let error = null;

const changed =
  !currentWork ||

  currentWork.price !== price ||

  (listPrice !== undefined &&
  currentWork.list_price !== listPrice) ||

  currentWork.sale_price !== salePrice ||

  currentWork.discount_rate !== discountRate ||

currentWork.max_discount_rate !== maxDiscountRate ||

  currentWork.is_on_sale !== isOnSale ||

  (currentWork.sale_end_at ?? null) !==
    (saleEndAt
      ? saleEndAt.toISOString()
      : null) ||

  currentWork.playwright_status !==
  (isOnSale ? "SALE" : "NORMAL") ||

currentWork.is_bottom_price !==
  isBottomPrice ||

(restoredStage != null && currentWork.stage !== restoredStage) ||

currentWork.lowest_price !==
  lowestPrice ||

(fallbackActress != null &&
  currentWork.actress !== fallbackActress);

if (changed) {
  const result = await supabase
    .from("works")
    .update({
      ...workUpdate,
      updated_at: new Date().toISOString(),
    })
    .eq("product_id", productId)
    .select("id,title,list_price,price,sale_price,lowest_price,previous_realtime_rank,realtime_rank");

  updated = result.data;
  error = result.error;

  if (error) {
    console.error("UPDATE ERROR", error);
  }
} else {
  const { error: touchError } = await supabase
    .from("works")
    .update({ updated_at: new Date().toISOString() })
    .eq("product_id", productId);

  if (touchError) {
    console.error("UPDATE CHECKED_AT ERROR", touchError);
    throw touchError;
  }

  console.log(
    `[CHECKED] works変更なし ${productId}`
  );
}
  // 現在の価格を取得
  const { data: currentPrices, error: currentPricesError } = await supabase
    .from("work_prices")
    .select("id,display_name,period,price_kind,normal_price,sale_price")
    .eq("product_id", productId);

  if (currentPricesError) {
    throw new Error(
      `work_prices取得失敗 (${productId}): ${currentPricesError.message}`
    );
  }

  const currentMap = new Map(
    (currentPrices ?? []).map((price) => [
      `${price.display_name}\u0000${price.period ?? ""}`,
      price,
    ])
  );

  // 新しい価格を保存
  for (const price of data.prices) {
    const current = currentMap.get(`${price.name}\u0000${price.period ?? ""}`);

    if (!current) {
  // 新規追加
  const { error: insertPriceError } = await supabase
    .from("work_prices")
    .insert({
      product_id: productId,
      display_name: price.name,
      period: price.period ?? null,
      price_kind: getPriceKind(price),
      type: price.type,
      normal_price: price.normalPrice,
      sale_price: price.salePrice,
    });

  if (insertPriceError) {
    throw new Error(
      `work_prices追加失敗 (${productId}/${price.name}): ${insertPriceError.message}`
    );
  }

  // 初回価格を履歴にも保存
  const { error: insertHistoryError } = await supabase
    .from("price_history")
    .insert({
      product_id: productId,
      display_name: price.name,
      period: price.period ?? null,
      price_kind: getPriceKind(price),
      type: price.type,
      normal_price: price.normalPrice,
      sale_price: price.salePrice,
    });

  if (insertHistoryError) {
    throw new Error(
      `price_history追加失敗 (${productId}/${price.name}): ${insertHistoryError.message}`
    );
  }

  continue;
}

    // 価格変更あり？
    const changed =
      current.normal_price !== price.normalPrice ||
      current.sale_price !== price.salePrice ||
      current.price_kind !== getPriceKind(price);

    if (changed) {
      // 履歴保存
      const { error: insertHistoryError } = await supabase
  .from("price_history")
  .insert({
    product_id: productId,
    display_name: price.name,
    period: price.period ?? null,
    price_kind: getPriceKind(price),
    type: price.type,
    normal_price: price.normalPrice,
    sale_price: price.salePrice,
  });

      if (insertHistoryError) {
        throw new Error(
          `price_history追加失敗 (${productId}/${price.name}): ${insertHistoryError.message}`
        );
      }

      // 現在価格更新
      const { data: updatedPrices, error: updatePriceError } = await supabase
        .from("work_prices")
        .update({
          type: price.type,
          period: price.period ?? null,
          price_kind: getPriceKind(price),
          normal_price: price.normalPrice,
          sale_price: price.salePrice,
          updated_at: new Date().toISOString(),
        })
        .eq("id", current.id)
        .select("id");

      if (updatePriceError) {
        throw new Error(
          `work_prices更新失敗 (${productId}/${price.name}): ${updatePriceError.message}`
        );
      }
      if (!updatedPrices?.length) {
        throw new Error(
          `work_prices更新0件 (${productId}/${price.name}, id=${current.id})`
        );
      }
    }

    currentMap.delete(`${price.name}\u0000${price.period ?? ""}`);
  }

  // 取得できなくなった価格を削除
  for (const price of currentMap.values()) {
  const { data: deletedPrices, error: deletePriceError } = await supabase
    .from("work_prices")
    .delete()
    .eq("id", price.id)
    .select("id");

  if (deletePriceError) {
    throw new Error(
      `work_prices削除失敗 (${productId}/${price.display_name}): ${deletePriceError.message}`
    );
  }
  if (!deletedPrices?.length) {
    throw new Error(
      `work_prices削除0件 (${productId}/${price.display_name}, id=${price.id})`
    );
  }
}

if (updated && updated.length > 0) {
  await generateAndSaveInsight(updated[0]);

  if (isNewLowestPrice) {
    await saveLowestPriceEvent({
  workId: updated[0].id,
  currentPrice: currentDisplayPrice!,
  previousLowestPrice: currentWork?.lowest_price ?? null,
  lowestPrice: lowestPrice!,
});
  }
}
}
