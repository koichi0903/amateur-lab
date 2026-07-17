"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Work } from "@/types/work";

export default function AdminWorksPage() {
  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [stage, setStage] = useState("ALL");
  const [editingWork, setEditingWork] =
  useState<Work | null>(null);

  useEffect(() => {
    loadWorks();
  }, []);

  async function loadWorks() {
    setLoading(true);

    const { data } = await supabase
      .from("works")
      .select("*")
      .order("created_at", {
        ascending: false,
      });

    setWorks((data as Work[]) || []);

    setLoading(false);
  }

  async function deleteWork() {
  if (!editingWork) return;

  const ok = confirm(
    `「${editingWork.title}」を削除しますか？`
  );

  if (!ok) return;

  const { error } = await supabase
    .from("works")
    .delete()
    .eq("id", editingWork.id);

  if (error) {
    alert("削除に失敗しました");
    return;
  }

  alert("削除しました");

  setEditingWork(null);

  await loadWorks();
}

  const filteredWorks = works.filter((work) => {
  const matchKeyword =
    work.title
      ?.toLowerCase()
      .includes(keyword.toLowerCase());

  const matchStage =
    stage === "ALL" ||
    work.stage === stage;

  return matchKeyword && matchStage;
});

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
    onChange={(e) =>
      setKeyword(e.target.value)
    }
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
    <option value="ALL">
      全Stage
    </option>

    <option value="NEW">
      NEW
    </option>

    <option value="SEMI_NEW">
      SEMI_NEW
    </option>

    <option value="OLD">
      OLD
    </option>

    <option value="SALE">
      SALE
    </option>
  </select>
</div>

        {loading ? (
          <p className="mt-10">
            読み込み中...
          </p>
        ) : (
          <div className="mt-8 space-y-3">

            {filteredWorks.map((work) => (
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

  <div className="mt-4 flex gap-2">

  <button
  onClick={() =>
    setEditingWork(work)
  }
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

</div>
              </div>

            ))}

          </div>
        )}

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