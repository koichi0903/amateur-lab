"use client";

import { useState } from "react";

type Tab =
  | "analysis"
  | "review"
  | "price"
  | "info"
  | "related";

type Props = {
  analysis: React.ReactNode;
  review?: React.ReactNode;
  price: React.ReactNode;
  info: React.ReactNode;
  related?: React.ReactNode;
};

export default function WorkTabs({
  analysis,
  review,
  price,
  info,
  related,
}: Props) {
  const [tab, setTab] =
    useState<Tab>("analysis");

  const tabs = [
  { key: "analysis", label: "🤖 AI分析" },
  { key: "review", label: "⭐ レビュー" },
  { key: "price", label: "💴 価格推移" },
  { key: "info", label: "📄 作品情報" },
  { key: "related", label: "📚 関連作品" },
] as const;

  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">

      <div className="grid grid-cols-2 bg-zinc-50 sm:grid-cols-5">

        {tabs.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`min-w-0 border-b-2 px-2 py-3 text-sm font-bold transition-all duration-200 sm:px-5 sm:py-4 ${
              tab === item.key
                ? "border-pink-500 bg-white text-pink-600"
                : "border-transparent text-zinc-500 hover:bg-white hover:text-zinc-900"
            }`}
          >
            {item.label}
          </button>
        ))}

      </div>

      <div className="min-w-0 bg-white p-3 sm:p-8">

        {tab === "analysis" && analysis}

{tab === "review" &&
  (review ?? (
    <div className="py-20 text-center text-zinc-400">
      レビューは準備中です
    </div>
  ))}

{tab === "price" && price}

{tab === "info" && info}

{tab === "related" &&
  (related ?? (
    <div className="py-20 text-center text-zinc-400">
      関連作品は準備中です
    </div>
  ))}

      </div>

    </section>
  );
}
