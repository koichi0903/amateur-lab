import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isRecord } from "@/lib/dmm/fanzaAmateurCatalogNormalize";
import type { FanzaAmateurPriceHistoryRow } from "./fanzaAmateurPriceHistoryRows";

export async function loadAmateurSummaryPriceHistory(contentIds: string[], observedSince: string) {
  if (contentIds.length === 0) return [] as Array<{ content_id: string; observed_at: string; price: unknown }>;

  const pageSize = 1_000;
  const [changedPrices, weeklySnapshots] = await Promise.all([
    (async () => {
      const rows: Array<{ content_id: string; observed_at: string; price: unknown }> = [];
      for (let offset = 0; ; offset += pageSize) {
        const result = await supabaseAdmin.from("fanza_amateur_price_history")
          .select("content_id,observed_at,price")
          .eq("price_type", "summary")
          .in("content_id", contentIds)
          .gte("observed_at", observedSince)
          .order("observed_at", { ascending: false })
          .order("content_id", { ascending: true })
          .range(offset, offset + pageSize - 1);
        if (result.error) throw new Error(`素人作品の価格履歴を読み込めませんでした: ${result.error.message}`);
        const page = result.data ?? [];
        rows.push(...page);
        if (page.length < pageSize) return rows;
      }
    })(),
    (async () => {
      const rows: Array<{ content_id: string; observed_at: string; prices: unknown }> = [];
      for (let offset = 0; ; offset += pageSize) {
        const result = await supabaseAdmin.from("fanza_amateur_price_weekly_snapshots")
          .select("content_id,observed_at,prices")
          .in("content_id", contentIds)
          .gte("observed_at", observedSince)
          .order("observed_at", { ascending: false })
          .order("content_id", { ascending: true })
          .range(offset, offset + pageSize - 1);
        if (result.error) throw new Error(`素人作品の週次価格履歴を読み込めませんでした: ${result.error.message}`);
        const page = result.data ?? [];
        rows.push(...page);
        if (page.length < pageSize) return rows;
      }
    })(),
  ]);

  const records = new Map<string, { content_id: string; observed_at: string; price: unknown }>();
  for (const row of weeklySnapshots) {
    const prices = isRecord(row.prices) ? row.prices : {};
    records.set(`${row.content_id}\u0000${row.observed_at}`, {
      content_id: row.content_id,
      observed_at: row.observed_at,
      price: prices.price,
    });
  }
  for (const row of changedPrices) records.set(`${row.content_id}\u0000${row.observed_at}`, row);
  return [...records.values()];
}

export async function loadAmateurDetailPriceHistory(contentId: string, observedSince: string) {
  const pageSize = 1_000;
  const rows: FanzaAmateurPriceHistoryRow[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const result = await supabaseAdmin
      .from("fanza_amateur_price_history")
      .select("source_run_id,content_id,observed_at,price_type,price,list_price,price_data")
      .eq("content_id", contentId)
      .gte("observed_at", observedSince)
      .order("observed_at", { ascending: false })
      .order("price_type", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (result.error) throw new Error(`素人作品の価格履歴を読み込めませんでした: ${result.error.message}`);
    const page = (result.data ?? []) as FanzaAmateurPriceHistoryRow[];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}
