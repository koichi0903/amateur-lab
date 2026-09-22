"use client";
import Image from "next/image";
import { useState } from "react";
import type { DmmItem } from "@/types/dmm";
import { supabase } from "@/lib/supabase";

type RegistrationState = "registered" | "partial" | "failed";

export default function AdminSearchPage() {
  const [keyword, setKeyword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [searchResults, setSearchResults] =
    useState<DmmItem[]>([]);

  const [registeredIds, setRegisteredIds] =
  useState(new Set<string>());

  const [registrationStates, setRegistrationStates] =
  useState(new Map<string, RegistrationState>());

  const [searchError, setSearchError] = useState("");

  const [registeringIds, setRegisteringIds] =
  useState(new Set<string>());

  const [selectedIds, setSelectedIds] =
  useState(new Set<string>());

  const [progress, setProgress] =
  useState({
    current: 0,
    total: 0,
    running: false,
    title: "",
  });

  const [logs, setLogs] = useState<string[]>([]);

  const [showOnlyUnregistered, setShowOnlyUnregistered] =
  useState(false);

  const handleSearch = async () => {
    if (!keyword.trim()) return;

    setLoading(true);
    setSearchError("");

    try {
      const res = await fetch(
        `/api/dmm?keyword=${encodeURIComponent(
          keyword
        )}`
      );

      const data = await res.json();

      if (!res.ok || data.success !== true || !Array.isArray(data.items)) {
        setSearchResults([]);
        setRegisteredIds(new Set());
        setSearchError(
          data.error?.message || "DMM検索に失敗しました。検索結果は0件として扱っていません。",
        );
        return;
      }

      const items: DmmItem[] = data.items;

      setSearchResults(items);

// 検索結果だけ登録済み判定
      const ids = items.map((item) => item.content_id);

      if (ids.length === 0) {
        setRegisteredIds(new Set());
        return;
      }

      const { data: registered } = await supabase
        .from("works")
        .select("product_id")
        .in("product_id", ids);

      setRegisteredIds(
        new Set((registered ?? []).map((work) => work.product_id)),
      );
    } catch (error) {
      console.error(error);
      setSearchResults([]);
      setRegisteredIds(new Set());
      setSearchError("検索結果を取得できませんでした。時間をおいて再試行してください。");
    } finally {
      setLoading(false);
    }
  };

  const registerItems = async (
  items: DmmItem[],
  showAlert = false
) => {
  setProgress({
    current: 0,
    total: items.length,
    running: true,
    title: "",
  });

  let success = 0;
  let failed = 0;
  setLogs([]);
  let current = 0;

  for (const item of items) {
    current++;

    setProgress({
      current,
      total: items.length,
      running: true,
      title: item.title,
    });

    try {
      const result = await handleRegister(item, false);
      if (result?.status === "registered") {
        success++;
        setLogs((prev) => [...prev, `✅ ${item.content_id} 登録完了`]);
      } else {
        failed++;
        setLogs((prev) => [
          ...prev,
          `${result?.status === "partial" ? "⚠️" : "❌"} ${item.content_id} ${result?.message ?? "登録失敗"}`,
        ]);
      }
    } catch (error) {
      console.error(error);
      failed++;
      setLogs((prev) => [
  ...prev,
  `❌ ${item.content_id}`,
]);
    }
  }

  setProgress({
    current: items.length,
    total: items.length,
    running: false,
    title: "",
  });

  if (showAlert) {
    alert(
      `登録完了\n成功: ${success}件\n失敗: ${failed}件`
    );
  }

  return {
    success,
    failed,
  };
};

  const handleRegister = async (
  item: DmmItem,
  showAlert = true
) => {
  try {
    setRegisteringIds((prev) => {
  const next = new Set(prev);

  next.add(item.content_id);

  return next;
});

    const res = await fetch(
      "/api/register-work",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify(item),
      }
    );

    const result =
      await res.json();

    if (result.status === "registered" || result.status === "already_registered") {
      setRegistrationStates((prev) => new Map(prev).set(item.content_id, "registered"));
      setRegisteredIds((prev) => new Set(prev).add(item.content_id));
    } else if (result.status === "partial") {
      setRegistrationStates((prev) => new Map(prev).set(item.content_id, "partial"));
    } else {
      setRegistrationStates((prev) => new Map(prev).set(item.content_id, "failed"));
    }

    if (showAlert) alert(result.message || "登録処理が完了しました");
    return result;

  } catch (error) {
  console.error(error);

  if (showAlert) {
    alert("登録に失敗しました");
  }
  return null;
} finally {
  setRegisteringIds((prev) => {
    const next = new Set(prev);

    next.delete(item.content_id);

    return next;
  });
}
};

  const toggleSelect = (
  productId: string
) => {
  setSelectedIds((prev) => {
    const next = new Set(prev);

    if (next.has(productId)) {
      next.delete(productId);
    } else {
      next.add(productId);
    }

    return next;
  });
};

  const selectAll = () => {
  setSelectedIds(
    new Set(
      searchResults
        .filter(
          (item) =>
            !registeredIds.has(
              item.content_id
            )
        )
        .map(
          (item) =>
            item.content_id
        )
    )
  );
};

const clearSelection = () => {
  setSelectedIds(new Set());
};

const handleSelectedRegister = async () => {
  const targets = searchResults.filter(
    (item) =>
      selectedIds.has(item.content_id) &&
      !registeredIds.has(item.content_id)
  );

  await registerItems(targets, true);

  setSelectedIds(new Set());
};

const handleRegisterAll = async () => {
  const targets = searchResults.filter(
    (item) =>
      !registeredIds.has(item.content_id)
  );

  if (targets.length === 0) {
    alert("未登録作品はありません");
    return;
  }

  setSelectedIds(
    new Set(
      targets.map(
        (item) => item.content_id
      )
    )
  );

  await registerItems(targets, true);

  setSelectedIds(new Set());
};

const displayResults = searchResults.filter(
  (item) =>
    !showOnlyUnregistered ||
    !registeredIds.has(item.content_id)
);


  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl p-10">

        <h1 className="text-4xl font-black">
          🔍 DMM検索
        </h1>

        <p className="mt-2 text-zinc-400">
          DMM作品を検索して登録します。
        </p>

        <div className="mt-8 flex gap-3">

          <input
            value={keyword}
            onChange={(e) =>
              setKeyword(e.target.value)
            }
            placeholder="検索キーワード"
            className="
              flex-1
              rounded-lg
              border
              border-zinc-700
              bg-zinc-900
              px-4
              py-3
            "
          />

          <button
            onClick={handleSearch}
            disabled={loading}
            className="
              rounded-lg
              bg-purple-600
              px-6
              py-3
              font-bold
            "
          >
            {loading
              ? "検索中..."
              : "検索"}
          </button>

        </div>

        {progress.running && (

  <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-5">

    <div className="mb-2 text-sm text-zinc-400">
      登録中...
    </div>

    <div className="mb-3 h-3 overflow-hidden rounded bg-zinc-800">

      <div
        className="h-full bg-green-500 transition-all"
        style={{
          width: `${
            progress.total === 0
              ? 0
              : (progress.current /
                  progress.total) *
                100
          }%`,
        }}
        
      />

    </div>

    <div className="text-sm">

      {progress.current} / {progress.total}

    </div>

    <div className="mt-2 text-xs text-zinc-400 truncate">

      {progress.title}

    </div>

  </div>

)}

{logs.length > 0 && (
  <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
    <h2 className="mb-3 font-bold">
      登録ログ
    </h2>

    <div className="max-h-64 overflow-y-auto text-sm space-y-1">
      {logs.map((log, index) => (
        <div key={index}>{log}</div>
      ))}
    </div>
  </div>
)}

        <div className="mt-10">

          {searchError && (
            <div className="mb-4 rounded-lg border border-red-800 bg-red-950/50 p-4 text-sm text-red-200" role="alert">
              検索エラー：{searchError}
            </div>
          )}

          <p className="mb-4 text-zinc-400">
            
            検索結果：
{displayResults.length}件
          </p>

          <div className="mb-6 flex gap-3">

  <label className="flex items-center gap-2 text-sm">
  <input
    type="checkbox"
    checked={showOnlyUnregistered}
    onChange={(e) =>
      setShowOnlyUnregistered(
        e.target.checked
      )
    }
  />

  未登録のみ
</label>
  
  <button
    onClick={selectAll}
    className="
      rounded-lg
      bg-zinc-800
      px-4
      py-2
      text-sm
      font-bold
      hover:bg-zinc-700
    "
  >
    ☑ 全選択
  </button>

  <button
    onClick={clearSelection}
    className="
      rounded-lg
      bg-zinc-800
      px-4
      py-2
      text-sm
      font-bold
      hover:bg-zinc-700
    "
  >
    ☐ 全解除
  </button>

  <div className="flex items-center text-sm text-zinc-400">
    選択：
    {selectedIds.size}件
  </div>

  <button
  onClick={handleSelectedRegister}
  disabled={selectedIds.size === 0}
  className="
    rounded-lg
    bg-green-600
    px-4
    py-2
    text-sm
    font-bold
    transition
    disabled:cursor-not-allowed
    disabled:opacity-50
    hover:bg-green-500
  "
>
  📥 選択登録
</button>

<button
  onClick={handleRegisterAll}
  className="
    rounded-lg
    bg-blue-600
    px-4
    py-2
    text-sm
    font-bold
    transition
    hover:bg-blue-500
  "
>
  🚀 全件登録
</button>

</div>

    {displayResults.map((item) => {
      const registrationState = registrationStates.get(item.content_id);
      const isRegistered = registrationState === "registered" || (!registrationState && registeredIds.has(item.content_id));
      const isPartial = registrationState === "partial";
      return (
  <div
    key={item.content_id}
    className="
      mb-4
      flex
      gap-4
      rounded-xl
      border
      border-zinc-800
      bg-zinc-900
      p-4
    "
  >

    <input
  type="checkbox"
  checked={selectedIds.has(item.content_id)}
  onChange={() =>
    toggleSelect(item.content_id)
  }
  className="mt-2 h-5 w-5"
/>
    {item.imageURL?.large && (
      <Image
        src={item.imageURL.large}
        alt={item.title}
        width={112}
        height={158}
        className="h-auto w-28 rounded-lg"
      />
    )}

    <div className="flex-1">
      <h2 className="text-lg font-bold">
        {item.title}
      </h2>

      <p className="mt-2 text-sm text-zinc-400">
        メーカー：
        {item.iteminfo?.maker?.[0]?.name ??
          "-"}
      </p>

      <p className="text-sm text-zinc-400">
        発売日：
        {item.date}
      </p>

      <p
  className={`mt-3 font-bold ${
    isRegistered
      ? "text-green-400"
      : isPartial
        ? "text-orange-300"
        : "text-yellow-400"
  }`}
>
  {isRegistered
    ? "✅ 登録済み"
    : isPartial
      ? "⚠️ 不完全・要再試行"
      : registrationState === "failed"
        ? "❌ 登録失敗"
        : "🆕 未登録"}
</p>
      {!isRegistered && (
  <button
    onClick={() => handleRegister(item)}
    disabled={registeringIds.has(item.content_id)}
    className="
      mt-3
      rounded-lg
      bg-purple-600
      px-4
      py-2
      text-sm
      font-bold
      transition
      disabled:cursor-not-allowed
      disabled:opacity-50
      hover:bg-purple-500
    "
  >
    {registeringIds.has(item.content_id)
      ? "⏳ 登録中..."
      : "📥 登録"}
  </button>
)}

      
    </div>
  </div>
      );
    })}

        </div>

      </div>
    </main>
  );
}
