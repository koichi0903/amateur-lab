"use client";
import { useState } from "react";
import type { DmmItem } from "@/types/dmm";
import { supabase } from "@/lib/supabase";
export type RegistrationState = "registered" | "partial" | "failed";

type SearchStageDiagnostic = {
  httpStatus: number | null;
  logicalStatus: string | null;
  logicalCode: string | null;
  totalCount: number | null;
  itemsLength: number | null;
  responseShape: "valid" | "invalid" | "unavailable";
};

export type SearchDiagnostics = {
  requestedKeyword: string;
  primary: SearchStageDiagnostic;
  actressSearch: SearchStageDiagnostic & {
    attempted: boolean;
    returnedCount: number;
    exactMatchCount: number;
    exactMatches: Array<{ name: string; actress_id: string }>;
  };
  actressFallback: SearchStageDiagnostic & {
    attempted: boolean;
    selectedActressId: string | null;
  };
  finalSource: "keyword" | "actress" | "none";
  normalizedFinalItemsLength: number;
};

export function diagnosticStatus(stage: SearchStageDiagnostic) {
  if (stage.responseShape === "unavailable") return "未実行";
  if (stage.responseShape === "invalid") return "形式不正";
  if (stage.httpStatus !== 200) return `HTTP ${stage.httpStatus ?? "-"}`;
  if (stage.logicalStatus && stage.logicalStatus !== "200") return `status ${stage.logicalStatus}`;
  if (stage.logicalCode && !["0", "200"].includes(stage.logicalCode)) return `code ${stage.logicalCode}`;
  return "正常";
}

export function useAdminSearchController() {
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

  const [searchMode, setSearchMode] = useState<"keyword" | "cid" | "actress" | "">("");

  const [searchDiagnostics, setSearchDiagnostics] =
    useState<SearchDiagnostics | null>(null);

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
    setSearchMode("");

    try {
      const res = await fetch(
        `/api/dmm?keyword=${encodeURIComponent(
          keyword
        )}`
      );

      const data = await res.json();
      setSearchDiagnostics(data.diagnostics ?? null);

      if (!res.ok || data.success !== true || !Array.isArray(data.items)) {
        setSearchResults([]);
        setRegisteredIds(new Set());
        setSearchMode("");
        setSearchError(
          data.error?.message || "DMM検索に失敗しました。検索結果は0件として扱っていません。",
        );
        return;
      }

      const items: DmmItem[] = data.items;

      setSearchResults(items);
      setSearchMode(data.meta?.searchMode ?? "keyword");

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
      setSearchMode("");
      setSearchDiagnostics(null);
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

  return {
    keyword, setKeyword, loading, searchResults, registeredIds, registrationStates,
    searchError, searchMode, searchDiagnostics, registeringIds, selectedIds,
    progress, logs, showOnlyUnregistered, setShowOnlyUnregistered, displayResults,
    handleSearch, handleRegister, toggleSelect, selectAll, clearSelection,
    handleSelectedRegister, handleRegisterAll,
  };
}
