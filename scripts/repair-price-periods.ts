import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type WorkPrice = {
  product_id: string;
  display_name: string;
  period: string | null;
};

type Work = { product_id: string; url: string | null };

async function readAllWorkPrices() {
  const rows: WorkPrice[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from("work_prices")
      .select("product_id,display_name,period")
      .range(offset, offset + 999);
    if (error) throw error;
    rows.push(...((data ?? []) as WorkPrice[]));
    if (!data?.length || data.length < 1000) return rows;
  }
}

async function readWorks(productIds: string[]) {
  const works: Work[] = [];
  for (let offset = 0; offset < productIds.length; offset += 500) {
    const { data, error } = await supabase
      .from("works")
      .select("product_id,url")
      .in("product_id", productIds.slice(offset, offset + 500));
    if (error) throw error;
    works.push(...((data ?? []) as Work[]));
  }
  return works;
}

async function resetHistory(productId: string) {
  const { data: current, error: currentError } = await supabase
    .from("work_prices")
    .select("product_id,display_name,period,price_kind,type,normal_price,sale_price")
    .eq("product_id", productId);
  if (currentError) throw currentError;

  const { error: deleteError } = await supabase
    .from("price_history")
    .delete()
    .eq("product_id", productId);
  if (deleteError) throw deleteError;

  if (!current?.length) return;
  const changedAt = new Date().toISOString();
  const { error: insertError } = await supabase.from("price_history").insert(
    current.map((row) => ({
      product_id: row.product_id,
      changed_at: changedAt,
      display_name: row.display_name,
      period: row.period ?? null,
      price_kind: row.price_kind,
      type: row.type,
      normal_price: row.normal_price,
      sale_price: row.sale_price,
    })),
  );
  if (insertError) throw insertError;
}

async function main() {
  const { closeBrowser, createBrowser } = await import("@/lib/playwright/browserManager");
  const { updatePlaywrightItem } = await import("@/lib/playwright/updatePlaywrightItem");

  const { error: schemaError } = await supabase
    .from("work_prices")
    .select("product_id,period")
    .limit(1);
  if (schemaError) {
    throw new Error(`period列が未適用です。先に supabase/migrations/20260824_add_price_period.sql を実行してください: ${schemaError.message}`);
  }

  const prices = await readAllWorkPrices();
  const byProduct = new Map<string, WorkPrice[]>();
  for (const row of prices) byProduct.set(row.product_id, [...(byProduct.get(row.product_id) ?? []), row]);

  const detectedTargets = [...byProduct.entries()]
    .filter(([, rows]) => {
      const names = new Map<string, Set<string>>();
      for (const row of rows) {
        const periods = names.get(row.display_name) ?? new Set<string>();
        periods.add(row.period ?? "");
        names.set(row.display_name, periods);
      }
      return [...names.values()].some((periods) => periods.size > 1);
    })
    .map(([productId]) => productId);

  const requestedProductId = process.env.REPAIR_PRODUCT_ID?.trim();
  const targets = requestedProductId ? [requestedProductId] : detectedTargets;

  const limit = Number(process.env.REPAIR_LIMIT ?? targets.length);
  const selected = targets.slice(0, Number.isFinite(limit) && limit > 0 ? limit : targets.length);
  const works = await readWorks(selected);
  console.log(`[repair] 対象 ${targets.length}作品、今回 ${works.length}作品`);

  const browser = await createBrowser();
  try {
    const configuredConcurrency = Number(process.env.REPAIR_CONCURRENCY ?? 3);
    const concurrency = Number.isFinite(configuredConcurrency)
      ? Math.max(1, Math.min(4, Math.floor(configuredConcurrency)))
      : 3;
    let cursor = 0;

    async function worker() {
      while (true) {
        const index = cursor++;
        const work = works[index];
        if (!work) return;

        try {
          await updatePlaywrightItem(work.product_id, work.url, browser);
          await resetHistory(work.product_id);
          console.log(`[repair] 完了 ${work.product_id}`);
        } catch (error) {
          console.error(`[repair] 失敗 ${work.product_id}`, error);
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(concurrency, works.length) }, () => worker()),
    );
  } finally {
    await closeBrowser(browser);
  }
}

void main();
