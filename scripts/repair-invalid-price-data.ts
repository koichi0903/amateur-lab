import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { createBrowser } from "../src/lib/playwright/browserManager";

const PAGE_SIZE = 1_000;
const CORRUPTED_8K_PRICE = 8;
const apply = process.argv.includes("--apply");
const requestedProductId = process.argv
  .find((argument) => argument.startsWith("--product="))
  ?.slice("--product=".length);
const requestedLimit = Number(
  process.argv
    .find((argument) => argument.startsWith("--limit="))
    ?.slice("--limit=".length) ?? Number.POSITIVE_INFINITY,
);
const requestedConcurrency = Number(
  process.argv
    .find((argument) => argument.startsWith("--concurrency="))
    ?.slice("--concurrency=".length) ?? 3,
);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase environment variables are missing");

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type PriceRow = {
  product_id: string;
  display_name: string;
  period: string | null;
  normal_price: number | null;
  sale_price: number | null;
};

type WorkRow = {
  product_id: string;
  title: string | null;
  url: string | null;
  list_price: number | null;
  price: number | null;
  lowest_price: number | null;
};

function isCorrupted8kPrice(row: PriceRow): boolean {
  return (
    /KVR版/i.test(row.display_name) &&
    row.normal_price === CORRUPTED_8K_PRICE &&
    row.sale_price === CORRUPTED_8K_PRICE
  );
}

async function fetchSuspiciousPrices(
  table: "work_prices" | "price_history",
): Promise<PriceRow[]> {
  const rows: PriceRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select("product_id,display_name,period,normal_price,sale_price")
      .eq("normal_price", CORRUPTED_8K_PRICE)
      .eq("sale_price", CORRUPTED_8K_PRICE)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as PriceRow[]));
    if ((data?.length ?? 0) < PAGE_SIZE) return rows;
  }
}

async function fetchSuspiciousWorkIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from("works")
    .select("product_id")
    .eq("price", CORRUPTED_8K_PRICE);
  if (error) throw error;
  return (data ?? []).map((work) => work.product_id);
}

async function fetchTargetWorks(productIds: string[]): Promise<WorkRow[]> {
  const rows: WorkRow[] = [];
  for (let index = 0; index < productIds.length; index += 100) {
    const ids = productIds.slice(index, index + 100);
    const { data, error } = await supabase
      .from("works")
      .select("product_id,title,url,list_price,price,lowest_price")
      .in("product_id", ids);
    if (error) throw error;
    rows.push(...((data ?? []) as WorkRow[]));
  }
  return rows;
}

async function deleteInvalidHistory(productId: string): Promise<number> {
  const { data: history, error: historyError } = await supabase
    .from("price_history")
    .select("id,product_id,display_name,period,normal_price,sale_price")
    .eq("product_id", productId);
  if (historyError) throw historyError;

  const invalidIds = (history ?? [])
    .filter((row) => isCorrupted8kPrice(row as PriceRow))
    .map((row) => row.id);
  if (invalidIds.length === 0) return 0;

  const { error: deleteError } = await supabase
    .from("price_history")
    .delete()
    .in("id", invalidIds);
  if (deleteError) throw deleteError;
  return invalidIds.length;
}

async function recomputeLowestPrice(productId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from("price_history")
    .select("normal_price,sale_price")
    .eq("product_id", productId);
  if (error) throw error;

  const values = (data ?? []).flatMap((row) => {
    const effective =
      row.sale_price != null && row.sale_price < row.normal_price
        ? row.sale_price
        : row.normal_price;
    return Number.isFinite(effective) && effective > 0 ? [effective] : [];
  });
  const lowestPrice = values.length > 0 ? Math.min(...values) : null;

  const { error: updateError } = await supabase
    .from("works")
    .update({ lowest_price: lowestPrice })
    .eq("product_id", productId);
  if (updateError) throw updateError;
  return lowestPrice;
}

async function verifyRepairedProduct(productId: string): Promise<void> {
  const [{ data: work, error: workError }, { data: prices, error: pricesError }] =
    await Promise.all([
      supabase
        .from("works")
        .select("price")
        .eq("product_id", productId)
        .single(),
      supabase
        .from("work_prices")
        .select("product_id,display_name,period,normal_price,sale_price")
        .eq("product_id", productId),
    ]);
  if (workError) throw workError;
  if (pricesError) throw pricesError;

  const invalid = (prices ?? []).filter((row) =>
    isCorrupted8kPrice(row as PriceRow),
  );
  if (work.price === CORRUPTED_8K_PRICE || invalid.length > 0) {
    throw new Error(
      `Repair verification failed (${productId}): summary=${work.price}, ` +
        `invalidRows=${invalid.length}`,
    );
  }
}

async function main() {
  const [currentPrices, historyPrices, suspiciousWorkIds] = await Promise.all([
    fetchSuspiciousPrices("work_prices"),
    fetchSuspiciousPrices("price_history"),
    fetchSuspiciousWorkIds(),
  ]);

  const invalidCurrent = currentPrices.filter(isCorrupted8kPrice);
  const invalidHistory = historyPrices.filter(isCorrupted8kPrice);
  let targetIds = [
    ...new Set(
      [
        ...invalidCurrent.map((row) => row.product_id),
        ...invalidHistory.map((row) => row.product_id),
        ...suspiciousWorkIds,
      ],
    ),
  ];
  if (requestedProductId) {
    targetIds = targetIds.filter((productId) => productId === requestedProductId);
  }
  if (Number.isFinite(requestedLimit)) {
    targetIds = targetIds.slice(0, Math.max(0, requestedLimit));
  }
  const works = await fetchTargetWorks(targetIds);

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "audit",
        suspiciousRowsRead: {
          currentPrices: currentPrices.length,
          historyPrices: historyPrices.length,
          workSummaries: suspiciousWorkIds.length,
        },
        affected: {
          works: targetIds.length,
          currentRows: invalidCurrent.length,
          historyRows: invalidHistory.length,
        },
        sample: works.slice(0, 20).map((work) => ({
          productId: work.product_id,
          title: work.title,
          currentSummaryPrice: work.price,
          invalidCurrentRows: invalidCurrent.filter(
            (row) => row.product_id === work.product_id,
          ),
          invalidHistoryRows: invalidHistory.filter(
            (row) => row.product_id === work.product_id,
          ).length,
        })),
      },
      null,
      2,
    ),
  );

  if (!apply || works.length === 0) return;

  const { updatePlaywrightItem } = await import(
    "../src/lib/playwright/updatePlaywrightItem"
  );
  const browser = await createBrowser();
  try {
    const concurrency = Math.max(
      1,
      Math.min(4, Math.floor(requestedConcurrency) || 1),
    );
    let cursor = 0;
    let repaired = 0;
    let failed = 0;

    async function worker() {
      while (true) {
        const index = cursor++;
        const work = works[index];
        if (!work) return;

        if (!work.url) {
          failed += 1;
          console.error(`[SKIP ${index + 1}/${works.length}] URLなし ${work.product_id}`);
          continue;
        }

        try {
          console.log(`[REPAIR ${index + 1}/${works.length}] ${work.product_id}`);
          const result = await updatePlaywrightItem(
            work.product_id,
            work.url,
            browser,
            work.list_price,
          );
          if (result !== "updated") {
            failed += 1;
            console.error(`[SKIP] ${work.product_id} result=${result}`);
            continue;
          }

          const deleted = await deleteInvalidHistory(work.product_id);
          const lowestPrice = await recomputeLowestPrice(work.product_id);
          await verifyRepairedProduct(work.product_id);
          repaired += 1;
          console.log(
            `[REPAIRED ${repaired}/${works.length}] ${work.product_id} ` +
              `invalidHistoryDeleted=${deleted} lowestPrice=${lowestPrice}`,
          );
        } catch (error) {
          failed += 1;
          console.error(`[FAILED ${index + 1}/${works.length}] ${work.product_id}`, error);
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(concurrency, works.length) }, () => worker()),
    );
    console.log(`[DONE] repaired=${repaired} failed=${failed} total=${works.length}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
