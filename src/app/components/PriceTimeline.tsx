"use client";

import { useState } from "react";
import { parsePriceHistoryDate } from "@/lib/createChartData";
import type { PriceHistoryItem } from "@/types/price";

type Props = { history: PriceHistoryItem[] };

const isSale = (item: PriceHistoryItem) =>
  item.price_kind === "sale" ||
  (item.price_kind == null &&
    item.sale_price != null &&
    item.normal_price != null &&
    item.sale_price < item.normal_price);

export default function PriceTimeline({ history }: Props) {
  const uniqueHistory = history.filter(
    (item, index, items) =>
      items.findIndex(
        (candidate) =>
          candidate.changed_at.slice(0, 16) === item.changed_at.slice(0, 16) &&
          candidate.display_name === item.display_name &&
          (candidate.period ?? null) === (item.period ?? null) &&
          candidate.type === item.type &&
          candidate.price_kind === item.price_kind &&
          candidate.normal_price === item.normal_price &&
          candidate.sale_price === item.sale_price,
      ) === index,
  );

  const grouped = Object.values(
    uniqueHistory.reduce<Record<string, PriceHistoryItem[]>>((acc, item) => {
      const key = item.changed_at.slice(0, 16);
      (acc[key] ??= []).push(item);
      return acc;
    }, {}),
  );

  const [visibleCount, setVisibleCount] = useState(2);
  const visibleGroups = grouped.slice(0, visibleCount);
  const remainingCount = Math.max(grouped.length - visibleCount, 0);

  return (
    <div className="space-y-6">
      {visibleGroups.map((group) => (
        <div key={group[0].changed_at} className="rounded-lg border p-3 shadow-sm">
          <div className="mb-3 rounded-md bg-gray-100 px-3 py-2 font-semibold text-gray-700">
            {parsePriceHistoryDate(group[0].changed_at).toLocaleString("ja-JP", {
              timeZone: "Asia/Tokyo",
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
          <div className="space-y-1">
            {group.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-md border-b py-1.5 last:border-0">
                <div className="min-w-0">
                  <span className="text-sm font-medium text-zinc-700">
                    {item.display_name}
                    {item.period ? `（${item.period}）` : ""}
                  </span>
                  <span className="ml-2 text-xs text-zinc-500">
                    {isSale(item) ? "期間限定セール" : "通常価格"}
                  </span>
                </div>
                <div className="min-w-[72px] text-right">
                  {isSale(item) && item.sale_price ? (
                    <>
                      <div className="text-xs text-gray-400 line-through">¥{item.normal_price?.toLocaleString()}</div>
                      <div className="text-sm font-bold text-red-600">¥{item.sale_price.toLocaleString()}</div>
                    </>
                  ) : (
                    <div className="text-sm font-bold text-zinc-900">¥{item.normal_price?.toLocaleString()}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {remainingCount > 0 && (
        <div className="pt-2 text-center">
          <button onClick={() => setVisibleCount((count) => count + 5)} className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-gray-100">
            価格履歴をもっと見る（残り{remainingCount}件）
          </button>
        </div>
      )}

      {grouped.length > 2 && remainingCount === 0 && (
        <div className="pt-2 text-center">
          <button onClick={() => setVisibleCount(2)} className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-gray-100">
            価格履歴を閉じる
          </button>
        </div>
      )}
    </div>
  );
}
