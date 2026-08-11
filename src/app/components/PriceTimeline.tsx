"use client";

import { useState } from "react";
import type { PriceHistoryItem } from "@/types/price";


type Props = {
  history: PriceHistoryItem[];
};

export default function PriceTimeline({
  history,
}: Props) {
  const grouped = Object.values(
    history.reduce<Record<string, PriceHistoryItem[]>>(
      (acc, item) => {
        const key = item.changed_at.slice(0, 16);

if (!acc[key]) {
  acc[key] = [];
}

acc[key].push(item);

        return acc;
      },
      {}
    )
  );

  const [expanded, setExpanded] = useState(false);

const visibleGroups = expanded
  ? grouped
  : grouped.slice(0, 2);

  return (
    <div className="space-y-6">
      {visibleGroups.map((group) => (
        <div
          key={group[0].changed_at}
          className="rounded-lg border p-3 shadow-sm"
        >
          <div className="mb-3 rounded-md bg-gray-100 px-3 py-2 font-semibold text-gray-700">
  📅{" "}
  {new Date(group[0].changed_at).toLocaleString(
    "ja-JP",
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }
  )}
</div>

          <div className="space-y-1">
  {group.map((item) => (
    <div
      key={item.id}
      className="flex items-center justify-between rounded-md border-b py-1.5 last:border-0"
    >
      <div className="flex items-center gap-2">
        <span className="text-lg">
          {item.display_name.includes("8K")
            ? "🟠"
            : item.display_name.includes("HQ")
            ? "🔵"
            : "🟣"}
        </span>

        <span className="text-sm font-medium text-zinc-700">
          {item.display_name
            .replace("ダウンロード＋ストリーミング", "DL")
            .replace(
              "HQ版ダウンロード＋HQ版ストリーミング",
              "HQ"
            )
            .replace(
              "8KVR版ダウンロード＋8KVR版ストリーミング",
              "8KVR"
            )}
        </span>
      </div>

      <div className="min-w-[72px] text-right">
        {item.sale_price ? (
          <>
            <div className="text-xs text-gray-400 line-through">
              ¥{item.normal_price?.toLocaleString()}
            </div>

            <div className="text-sm font-bold text-red-600">
              ¥{item.sale_price.toLocaleString()}
            </div>
          </>
        ) : (
          <div className="text-sm font-bold text-zinc-900">
            ¥{item.normal_price?.toLocaleString()}
          </div>
        )}
      </div>
    </div>
  ))}
</div>
</div>
            ))}

      {grouped.length > 2 && (
        <div className="pt-2 text-center">
          <button
            onClick={() =>
              setExpanded(!expanded)
            }
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-gray-100"
          >
            {expanded
              ? "▲ 閉じる"
              : `▼ 価格履歴をもっと見る（残り${grouped.length - 2}件）`}
          </button>
        </div>
      )}
    </div>
  );
}