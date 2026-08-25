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

type PriceHistoryKey = {
  id: number;
  product_id: string;
  display_name: string;
  period: string | null;
  normal_price: number | null;
  changed_at: string;
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

async function readAllPriceHistory() {
  const rows: PriceHistoryKey[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from("price_history")
      .select("id,product_id,display_name,period,normal_price,changed_at")
      .range(offset, offset + 999);
    if (error) throw error;
    rows.push(...((data ?? []) as PriceHistoryKey[]));
    if (!data?.length || data.length < 1000) return rows;
  }
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

const normalizeName = (value: string) => value.normalize("NFKC").replace(/\s+/g, "");

async function repairHistoryPeriods(productId: string) {
  const [{ data: current, error: currentError }, { data: history, error: historyError }] =
    await Promise.all([
      supabase
        .from("work_prices")
        .select("display_name,period,normal_price")
        .eq("product_id", productId),
      supabase
        .from("price_history")
        .select("id,display_name,period,normal_price,changed_at")
        .eq("product_id", productId)
        .order("changed_at", { ascending: false }),
    ]);
  if (currentError) throw currentError;
  if (historyError) throw historyError;

  const currentByName = new Map<string, NonNullable<typeof current>>();
  for (const row of current ?? []) {
    const key = normalizeName(row.display_name);
    const rows = currentByName.get(key) ?? [];
    rows.push(row);
    currentByName.set(key, rows);
  }

  const snapshotPrices = new Map<string, number[]>();
  for (const row of history ?? []) {
    if (row.normal_price == null) continue;
    const key = `${normalizeName(row.display_name)}\u0000${row.changed_at.slice(0, 16)}`;
    const prices = snapshotPrices.get(key) ?? [];
    if (!prices.includes(row.normal_price)) prices.push(row.normal_price);
    snapshotPrices.set(key, prices.sort((a, b) => a - b));
  }

  let repaired = 0;
  let removed = 0;
  for (const row of history ?? []) {
    if (row.period != null) continue;
    const name = normalizeName(row.display_name);
    const candidates = (currentByName.get(name) ?? []).filter((item) => item.period != null);
    let period: string | null = null;

    if (candidates.length === 1) {
      period = candidates[0].period;
    } else if (candidates.length > 1 && row.normal_price != null) {
      const exact = candidates.filter((item) => item.normal_price === row.normal_price);
      if (exact.length === 1) {
        period = exact[0].period;
      } else {
        const snapshotKey = `${name}\u0000${row.changed_at.slice(0, 16)}`;
        const prices = snapshotPrices.get(snapshotKey) ?? [];
        const sortedCandidates = [...candidates].sort(
          (a, b) => (a.normal_price ?? Number.MAX_SAFE_INTEGER) - (b.normal_price ?? Number.MAX_SAFE_INTEGER),
        );
        const index = prices.indexOf(row.normal_price);
        if (prices.length === sortedCandidates.length && index >= 0) {
          period = sortedCandidates[index].period;
        }
      }
    }

    if (period) {
      const { error } = await supabase.from("price_history").update({ period }).eq("id", row.id);
      if (error) throw error;
      repaired += 1;
    } else {
      // An unknown period would merge unrelated chart series. Keep only rows
      // that can be classified from the newly fetched authoritative plans.
      const { error } = await supabase.from("price_history").delete().eq("id", row.id);
      if (error) throw error;
      removed += 1;
    }
  }

  return { repaired, removed };
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

  const repairAll = process.argv.includes("--all");
  const prices = await readAllWorkPrices();
  const history = repairAll ? [] : await readAllPriceHistory();
  const byProduct = new Map<string, WorkPrice[]>();
  for (const row of prices) {
    const rows = byProduct.get(row.product_id) ?? [];
    rows.push(row);
    byProduct.set(row.product_id, rows);
  }

  const historyByProduct = new Map<string, PriceHistoryKey[]>();
  for (const row of history) {
    const rows = historyByProduct.get(row.product_id) ?? [];
    rows.push(row);
    historyByProduct.set(row.product_id, rows);
  }

  const periodMismatchTargets = [...byProduct.entries()]
    .filter(([productId, rows]) => {
      const historyRows = historyByProduct.get(productId) ?? [];
      if (historyRows.length === 0) return false;

      const historyPeriods = new Map<string, Set<string>>();
      for (const row of historyRows) {
        const periods = historyPeriods.get(row.display_name) ?? new Set<string>();
        periods.add(row.period ?? "");
        historyPeriods.set(row.display_name, periods);
      }

      return rows.some((row) => {
        const periods = historyPeriods.get(row.display_name);
        return Boolean(periods?.size && !periods.has(row.period ?? ""));
      });
    })
    .map(([productId]) => productId);

  // Before period became part of the key, two plans with the same display
  // name (for example HQ 7-day and unlimited) collapsed into one current row.
  // The history still exposes the collision because one scrape wrote two
  // different normal prices for the same name within the same minute.
  const ambiguousHistoryTargets = [...historyByProduct.entries()]
    .filter(([, rows]) => {
      const snapshots = new Map<string, Set<number>>();
      for (const row of rows) {
        if (row.period != null || row.normal_price == null) continue;
        const minute = row.changed_at.slice(0, 16);
        const key = `${row.display_name}\u0000${minute}`;
        const prices = snapshots.get(key) ?? new Set<number>();
        prices.add(row.normal_price);
        snapshots.set(key, prices);
      }
      return [...snapshots.values()].some((values) => values.size > 1);
    })
    .map(([productId]) => productId);

  const ambiguousTargets = [
    ...new Set([...periodMismatchTargets, ...ambiguousHistoryTargets]),
  ];
  const nullPeriodTargets = [...byProduct.entries()]
    .filter(([, rows]) => rows.some((row) => row.period == null))
    .map(([productId]) => productId);
  const detectedTargets = repairAll
    ? [...new Set([...ambiguousTargets, ...nullPeriodTargets])]
    : ambiguousTargets;

  const requestedProductId = process.env.REPAIR_PRODUCT_ID?.trim();
  const targets = (requestedProductId ? [requestedProductId] : detectedTargets).sort();

  // --all processes every detected target. REPAIR_LIMIT is only used when an
  // intentionally bounded run is requested.
  const limit = Number(process.env.REPAIR_LIMIT ?? targets.length);
  const selected = targets.slice(0, Number.isFinite(limit) && limit > 0 ? limit : targets.length);
  const works = await readWorks(selected);
  console.log(`[repair] 対象 ${targets.length}作品、今回 ${works.length}作品`);

  const failures: string[] = [];
  let completed = 0;
  const configuredConcurrency = Number(process.env.REPAIR_CONCURRENCY ?? 3);
  const concurrency = Number.isFinite(configuredConcurrency)
    ? Math.max(1, Math.min(4, Math.floor(configuredConcurrency)))
    : 3;
  const configuredBatchSize = Number(process.env.REPAIR_BATCH_SIZE ?? 200);
  const batchSize = Number.isFinite(configuredBatchSize)
    ? Math.max(1, Math.floor(configuredBatchSize))
    : 200;

  for (let batchStart = 0; batchStart < works.length; batchStart += batchSize) {
    const batch = works.slice(batchStart, batchStart + batchSize);
    const browser = await createBrowser();
    let cursor = 0;

    try {
      async function worker() {
        while (true) {
          const index = cursor++;
          const work = batch[index];
          if (!work) return;

          try {
            await updatePlaywrightItem(work.product_id, work.url, browser);
            const historyResult = repairAll
              ? await repairHistoryPeriods(work.product_id)
              : (await resetHistory(work.product_id), { repaired: 0, removed: 0 });
          console.log(
            `[repair] 完了 ${work.product_id} 履歴期間補正${historyResult.repaired}件` +
              ` 不明履歴削除${historyResult.removed}件`,
          );
          completed += 1;
        } catch (error) {
          failures.push(work.product_id);
          console.error(`[repair] 失敗 ${work.product_id}`, error);
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(concurrency, batch.length) }, () => worker()),
    );
    } finally {
      await closeBrowser(browser);
    }

    console.log(
      `[repair] batch ${Math.min(batchStart + batch.length, works.length)}/${works.length}`,
    );
  }

  console.log(
    `[repair] バッチ完了 成功${completed}件 失敗${failures.length}件` +
      ` 残り見込み${Math.max(0, targets.length - completed)}作品`,
  );
  if (failures.length > 0) {
    throw new Error(`価格期間補正に失敗した作品: ${failures.join(", ")}`);
  }
}

void main();
