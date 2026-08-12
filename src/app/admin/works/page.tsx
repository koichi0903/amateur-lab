"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Work } from "@/types/work";
import { insightGenerator } from "@/lib/insights";

export default function AdminWorksPage() {
  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [stage, setStage] = useState("ALL");
  const [editingWork, setEditingWork] =
  useState<Work | null>(null);

  const PAGE_SIZE = 50;

const [page, setPage] = useState(1);
const [totalCount, setTotalCount] = useState(0);

  const loadWorks = useCallback(async () => {
  setLoading(true);

  const from = (page - 1) * PAGE_SIZE;
const to = from + PAGE_SIZE - 1;

let query = supabase
  .from("works")
  .select("*", { count: "exact" });

if (stage !== "ALL") {
  query = query.eq("stage", stage);
}

if (keyword.trim() !== "") {
  query = query.ilike(
    "title",
    `%${keyword.trim()}%`
  );
}

const { data, error, count } = await query
  .order("created_at", {
    ascending: false,
  })
  .range(from, to);

  if (error) {
    console.error(error);
  }

  setWorks((data as Work[]) || []);
setTotalCount(count ?? 0);

setLoading(false);
}, [keyword, page, stage]);

  useEffect(() => {
  loadWorks();
}, [loadWorks]);

  async function deleteWork() {
  if (!editingWork) return;

  const ok = confirm(
    `「${editingWork.title}」を削除しますか？`
  );

  if (!ok) return;

  const response = await fetch(`/api/admin/works/${editingWork.id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    alert("削除に失敗しました");
    return;
  }

  alert("削除しました");

  setEditingWork(null);

  await loadWorks();
}

const totalPages = Math.max(
  1,
  Math.ceil(totalCount / PAGE_SIZE)
);

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl p-10">

        <h1 className="text-4xl font-black">
          📚 作品管理
        </h1>

        <p className="mt-2 text-zinc-400">
          登録済み作品一覧
        </p>

        <div className="mt-6">
  <input
    value={keyword}
    onChange={(e) => {
  setKeyword(e.target.value);
  setPage(1);
}}
    placeholder="作品名で検索"
    className="
      w-full
      rounded-lg
      border
      border-zinc-700
      bg-zinc-900
      px-4
      py-3
      text-white
    "
  />
</div>

<div className="mt-4">
  <select
    value={stage}
    onChange={(e) =>
      setStage(e.target.value)
    }
    className="
      rounded-lg
      border
      border-zinc-700
      bg-zinc-900
      px-4
      py-3
      text-white
    "
  >
    <option value="ALL">全Stage</option>
<option value="RESERVED">
  予約
</option>
<option value="NEW">新作</option>
<option value="SEMI_NEW">準新作</option>
<option value="OLD">旧作</option>
  </select>
</div>

        {loading ? (
          <p className="mt-10">
            読み込み中...
          </p>
        ) : (
          <div className="mt-8 space-y-3">

            

            {works.map((work) => {
  const insights = insightGenerator.generate({
  workId: work.id,
  title: work.title,
  listPrice: work.price,
  currentPrice: work.sale_price ?? work.price,
  lowestPrice: work.lowest_price,
});

  return (
              <div
                key={work.id}
                className="
                  rounded-xl
                  border
                  border-zinc-800
                  bg-zinc-900
                  p-5
                "
              >
                <div className="font-bold">
                  {work.title}
                </div>

                <div className="mt-2 text-sm text-zinc-400">
                  {work.product_id}
                </div>

                <div className="mt-1 text-sm">
                  スコア：
                  {work.score}
                </div>

  {insights.length > 0 && (
  <div className="mt-3 flex flex-wrap gap-2">
    {insights.map((insight) => (
      <span
        key={insight.type}
        className="
          rounded-full
          bg-emerald-600
          px-3
          py-1
          text-xs
          font-bold
        "
      >
        {insight.title}
      </span>
    ))}
  </div>
)}

  <div className="mt-4 flex gap-2">

  <button
    onClick={() => setEditingWork(work)}
    className="
      rounded-lg
      bg-blue-600
      px-4
      py-2
      text-sm
      font-bold
      hover:bg-blue-500
    "
  >
    ✏ 編集
  </button>

  <button
    onClick={async () => {
      try {
        const response = await fetch("/api/admin/insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workId: work.id }),
        });
        if (!response.ok) throw new Error("Failed to save insights");
        alert("Insightを保存しました");
      } catch (error) {
        console.error(error);
        alert("保存に失敗しました");
      }
    }}
    className="
      rounded-lg
      bg-emerald-600
      px-4
      py-2
      text-sm
      font-bold
      hover:bg-emerald-500
    "
  >
    💾 Insight
  </button>

</div>
              </div>

              );
})}

          </div>
        )}

      </div>

      <div className="mt-8 flex items-center justify-center gap-4">

  <button
    onClick={() => setPage((p) => Math.max(1, p - 1))}
    disabled={page === 1}
    className="
      rounded-lg
      bg-zinc-800
      px-4
      py-2
      disabled:opacity-40
    "
  >
    ← 前へ
  </button>

  <div className="text-center">

  <div className="font-bold">
    {page} / {totalPages} ページ
  </div>

  <div className="text-sm text-zinc-400">
    全 {totalCount.toLocaleString()} 件
  </div>

</div>

  <button
    onClick={() => setPage((p) => p + 1)}
    disabled={page >= totalPages}
    className="
      rounded-lg
      bg-zinc-800
      px-4
      py-2
      disabled:opacity-40
    "
  >
    次へ →
  </button>

</div>

      {editingWork && (
  <div
    className="
      fixed
      inset-0
      z-50
      flex
      items-center
      justify-center
      bg-black/70
      p-6
    "
  >
    <div
      className="
        w-full
        max-w-2xl
        rounded-2xl
        bg-zinc-900
        border
        border-zinc-700
        p-8
      "
    >
      <div className="flex items-center justify-between">

  <h2 className="text-2xl font-black">
    ✏ 作品編集
  </h2>

  <div className="flex gap-2">

    <button
  onClick={deleteWork}
  className="
    rounded-lg
    bg-red-600
    px-4
    py-2
    text-sm
    font-bold
    hover:bg-red-500
  "
>
  🗑 削除
</button>

    <button
      onClick={() => setEditingWork(null)}
      className="
        rounded-lg
        bg-zinc-700
        px-4
        py-2
        text-sm
        font-bold
        hover:bg-zinc-600
      "
    >
      ✕
    </button>

  </div>

</div>

      <div className="mt-8 space-y-6">

  <div>

    <p className="mb-2 text-sm text-zinc-400">
      タイトル
    </p>

    <input
      value={editingWork.title}
      readOnly
      className="
        w-full
        rounded-lg
        border
        border-zinc-700
        bg-zinc-800
        px-4
        py-3
      "
    />

  </div>

  <div>

    <p className="mb-2 text-sm text-zinc-400">
      Product ID
    </p>

    <input
      value={editingWork.product_id}
      readOnly
      className="
        w-full
        rounded-lg
        border
        border-zinc-700
        bg-zinc-800
        px-4
        py-3
      "
    />

  </div>

  <div>

    <p className="mb-2 text-sm text-zinc-400">
      Stage
    </p>

    <input
      value={editingWork.stage}
      readOnly
      className="
        w-full
        rounded-lg
        border
        border-zinc-700
        bg-zinc-800
        px-4
        py-3
      "
    />

  </div>

  <div>

    <p className="mb-2 text-sm text-zinc-400">
      スコア
    </p>

    <input
      value={editingWork.score}
      readOnly
      className="
        w-full
        rounded-lg
        border
        border-zinc-700
        bg-zinc-800
        px-4
        py-3
      "
    />

  </div>

</div>

    </div>
  </div>
)}
    </main>
  );
}
