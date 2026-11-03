import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { PriceInfo } from "./parser";
import { getPriceKind } from "./savePriceData";

type CurrentWorkPrice = {
  id: number;
  display_name: string;
  period: string | null;
  price_kind: string;
  normal_price: number;
  sale_price: number | null;
};

function workPriceKey(displayName: string, period: string | null | undefined) {
  return `${displayName}\u0000${period ?? ""}`;
}

function hasPriceChanged(current: CurrentWorkPrice, incoming: PriceInfo) {
  return (
    current.normal_price !== incoming.normalPrice ||
    current.sale_price !== incoming.salePrice ||
    current.price_kind !== getPriceKind(incoming)
  );
}

async function insertWorkPrice(
  productId: string,
  price: PriceInfo,
  client: SupabaseClient,
) {
  const priceRow = {
    product_id: productId,
    display_name: price.name,
    period: price.period ?? null,
    price_kind: getPriceKind(price),
    type: price.type,
    normal_price: price.normalPrice,
    sale_price: price.salePrice,
  };

  const { error: insertPriceError } = await client
    .from("work_prices")
    .insert(priceRow);

  if (insertPriceError) {
    throw new Error(
      `work_prices追加失敗 (${productId}/${price.name}): ${insertPriceError.message}`,
    );
  }

  const { error: insertHistoryError } = await client
    .from("price_history")
    .insert(priceRow);

  if (insertHistoryError) {
    throw new Error(
      `price_history追加失敗 (${productId}/${price.name}): ${insertHistoryError.message}`,
    );
  }
}

async function updateWorkPrice(
  productId: string,
  price: PriceInfo,
  current: CurrentWorkPrice,
  client: SupabaseClient,
) {
  const priceRow = {
    product_id: productId,
    display_name: price.name,
    period: price.period ?? null,
    price_kind: getPriceKind(price),
    type: price.type,
    normal_price: price.normalPrice,
    sale_price: price.salePrice,
  };

  const { error: insertHistoryError } = await client
    .from("price_history")
    .insert(priceRow);

  if (insertHistoryError) {
    throw new Error(
      `price_history追加失敗 (${productId}/${price.name}): ${insertHistoryError.message}`,
    );
  }

  const { data: updatedPrices, error: updatePriceError } = await client
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
      `work_prices更新失敗 (${productId}/${price.name}): ${updatePriceError.message}`,
    );
  }
  if (!updatedPrices?.length) {
    throw new Error(
      `work_prices更新0件 (${productId}/${price.name}, id=${current.id})`,
    );
  }
}

async function deleteStaleWorkPrice(
  productId: string,
  price: CurrentWorkPrice,
  client: SupabaseClient,
) {
  const { data: deletedPrices, error: deletePriceError } = await client
    .from("work_prices")
    .delete()
    .eq("id", price.id)
    .select("id");

  if (deletePriceError) {
    throw new Error(
      `work_prices削除失敗 (${productId}/${price.display_name}): ${deletePriceError.message}`,
    );
  }
  if (!deletedPrices?.length) {
    throw new Error(
      `work_prices削除0件 (${productId}/${price.display_name}, id=${price.id})`,
    );
  }
}

export async function syncWorkPrices(
  productId: string,
  prices: PriceInfo[],
  client: SupabaseClient = supabaseAdmin,
): Promise<boolean> {
  const { data: currentPrices, error: currentPricesError } = await client
    .from("work_prices")
    .select("id,display_name,period,price_kind,normal_price,sale_price")
    .eq("product_id", productId);

  if (currentPricesError) {
    throw new Error(
      `work_prices取得失敗 (${productId}): ${currentPricesError.message}`,
    );
  }

  const currentMap = new Map<string, CurrentWorkPrice>(
    (currentPrices ?? []).map((price) => [
      workPriceKey(price.display_name, price.period),
      price,
    ]),
  );
  let priceDataChanged = false;

  for (const price of prices) {
    const key = workPriceKey(price.name, price.period);
    const current = currentMap.get(key);

    if (!current) {
      await insertWorkPrice(productId, price, client);
      priceDataChanged = true;
      continue;
    }

    if (hasPriceChanged(current, price)) {
      await updateWorkPrice(productId, price, current, client);
      priceDataChanged = true;
    }

    currentMap.delete(key);
  }

  for (const stalePrice of currentMap.values()) {
    await deleteStaleWorkPrice(productId, stalePrice, client);
    priceDataChanged = true;
  }

  return priceDataChanged;
}
