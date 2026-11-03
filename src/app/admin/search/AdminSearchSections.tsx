"use client";

import Image from "next/image";
import type { DmmItem } from "@/types/dmm";
import {
  diagnosticStatus,
  type RegistrationState,
  type SearchDiagnostics,
} from "./useAdminSearchController";

type RegistrationProgress = {
  current: number;
  total: number;
  running: boolean;
  title: string;
};

export function AdminSearchProgress({
  progress,
  logs,
}: {
  progress: RegistrationProgress;
  logs: string[];
}) {
  return (
    <>
      {progress.running && (
        <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="mb-2 text-sm text-zinc-400">登録中...</div>
          <div className="mb-3 h-3 overflow-hidden rounded bg-zinc-800">
            <div
              className="h-full bg-green-500 transition-all"
              style={{
                width: `${progress.total === 0 ? 0 : (progress.current / progress.total) * 100}%`,
              }}
            />
          </div>
          <div className="text-sm">
            {progress.current} / {progress.total}
          </div>
          <div className="mt-2 text-xs text-zinc-400 truncate">{progress.title}</div>
        </div>
      )}

      {logs.length > 0 && (
        <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="mb-3 font-bold">登録ログ</h2>
          <div className="max-h-64 overflow-y-auto text-sm space-y-1">
            {logs.map((log, index) => (
              <div key={index}>{log}</div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function KeywordItemListDiagnostic({ diagnostic }: { diagnostic: SearchDiagnostics["primary"] }) {
  return (
    <div className="rounded border border-cyan-900/60 p-2">
      <div className="font-semibold">1. keyword ItemList</div>
      <div>状態: {diagnosticStatus(diagnostic)}</div>
      <div>HTTP: {diagnostic.httpStatus ?? "-"} / status: {diagnostic.logicalStatus ?? "-"} / code: {diagnostic.logicalCode ?? "-"}</div>
      <div>total_count: {diagnostic.totalCount ?? "-"} / items: {diagnostic.itemsLength ?? "-"}</div>
    </div>
  );
}

function ActressSearchDiagnostic({ diagnostic }: { diagnostic: SearchDiagnostics["actressSearch"] }) {
  return (
    <div className="rounded border border-cyan-900/60 p-2">
      <div className="font-semibold">2. ActressSearch</div>
      <div>実行: {diagnostic.attempted ? "yes" : "no"} / 状態: {diagnosticStatus(diagnostic)}</div>
      <div>returned: {diagnostic.returnedCount} / 完全一致: {diagnostic.exactMatchCount}</div>
      <div>HTTP: {diagnostic.httpStatus ?? "-"} / status: {diagnostic.logicalStatus ?? "-"} / code: {diagnostic.logicalCode ?? "-"}</div>
      {diagnostic.exactMatches.length > 0 && (
        <div className="mt-1 break-words">候補: {diagnostic.exactMatches.map((match) => `${match.name} (${match.actress_id})`).join(", ")}</div>
      )}
    </div>
  );
}

function ActressItemListDiagnostic({ diagnostic }: { diagnostic: SearchDiagnostics["actressFallback"] }) {
  return (
    <div className="rounded border border-cyan-900/60 p-2">
      <div className="font-semibold">3. actress ItemList</div>
      <div>実行: {diagnostic.attempted ? "yes" : "no"} / 状態: {diagnosticStatus(diagnostic)}</div>
      <div>actress_id: {diagnostic.selectedActressId ?? "-"}</div>
      <div>HTTP: {diagnostic.httpStatus ?? "-"} / status: {diagnostic.logicalStatus ?? "-"} / code: {diagnostic.logicalCode ?? "-"}</div>
      <div>total_count: {diagnostic.totalCount ?? "-"} / items: {diagnostic.itemsLength ?? "-"}</div>
    </div>
  );
}

export function AdminSearchDiagnostics({
  searchDiagnostics,
}: {
  searchDiagnostics: SearchDiagnostics | null;
}) {
  if (!searchDiagnostics) return null;

  return (
    <section className="mb-6 rounded-lg border border-cyan-900/70 bg-cyan-950/20 p-4 text-xs text-cyan-100" aria-label="検索診断">
      <h2 className="mb-3 text-sm font-bold text-cyan-200">検索診断</h2>
      <div className="grid gap-2 md:grid-cols-3">
        <KeywordItemListDiagnostic diagnostic={searchDiagnostics.primary} />
        <ActressSearchDiagnostic diagnostic={searchDiagnostics.actressSearch} />
        <ActressItemListDiagnostic diagnostic={searchDiagnostics.actressFallback} />
      </div>
      <div className="mt-3 text-cyan-200">
        keyword: {searchDiagnostics.requestedKeyword} / finalSource: {searchDiagnostics.finalSource} / normalized final items: {searchDiagnostics.normalizedFinalItemsLength}
      </div>
    </section>
  );
}

export function AdminSearchSelection({
  showOnlyUnregistered,
  onShowOnlyUnregisteredChange,
  selectedCount,
  onSelectAll,
  onClearSelection,
  onRegisterSelected,
  onRegisterAll,
}: {
  showOnlyUnregistered: boolean;
  onShowOnlyUnregisteredChange: (checked: boolean) => void;
  selectedCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onRegisterSelected: () => void;
  onRegisterAll: () => void;
}) {
  return (
    <div className="mb-6 flex gap-3">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={showOnlyUnregistered}
          onChange={(event) => onShowOnlyUnregisteredChange(event.target.checked)}
        />
        未登録のみ
      </label>
      <button
        onClick={onSelectAll}
        className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-bold hover:bg-zinc-700"
      >
        ☑ 全選択
      </button>
      <button
        onClick={onClearSelection}
        className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-bold hover:bg-zinc-700"
      >
        ☐ 全解除
      </button>
      <div className="flex items-center text-sm text-zinc-400">選択：{selectedCount}件</div>
      <button
        onClick={onRegisterSelected}
        disabled={selectedCount === 0}
        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 hover:bg-green-500"
      >
        📥 選択登録
      </button>
      <button
        onClick={onRegisterAll}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold transition hover:bg-blue-500"
      >
        🚀 全件登録
      </button>
    </div>
  );
}

function registrationPresentation(state: RegistrationState | undefined, hasRegisteredId: boolean) {
  const isRegistered = state === "registered" || (!state && hasRegisteredId);
  const isPartial = state === "partial";
  return {
    isRegistered,
    className: isRegistered ? "text-green-400" : isPartial ? "text-orange-300" : "text-yellow-400",
    label: isRegistered
      ? "✅ 登録済み"
      : isPartial
        ? "⚠️ 不完全・要再試行"
        : state === "failed"
          ? "❌ 登録失敗"
          : "🆕 未登録",
  };
}

function AdminSearchResultCard({
  item,
  registrationState,
  isRegisteredId,
  isRegistering,
  selected,
  onToggleSelect,
  onRegister,
}: {
  item: DmmItem;
  registrationState: RegistrationState | undefined;
  isRegisteredId: boolean;
  isRegistering: boolean;
  selected: boolean;
  onToggleSelect: (contentId: string) => void;
  onRegister: (item: DmmItem) => void;
}) {
  const presentation = registrationPresentation(registrationState, isRegisteredId);
  return (
    <div className="mb-4 flex gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggleSelect(item.content_id)}
        className="mt-2 h-5 w-5"
      />
      {item.imageURL?.large && <Image src={item.imageURL.large} alt={item.title} width={112} height={158} className="h-auto w-28 rounded-lg" />}
      <div className="flex-1">
        <h2 className="text-lg font-bold">{item.title}</h2>
        <p className="mt-2 text-sm text-zinc-400">メーカー：{item.iteminfo?.maker?.[0]?.name ?? "-"}</p>
        <p className="text-sm text-zinc-400">発売日：{item.date}</p>
        <p className={`mt-3 font-bold ${presentation.className}`}>{presentation.label}</p>
        {!presentation.isRegistered && (
          <button
            onClick={() => onRegister(item)}
            disabled={isRegistering}
            className="mt-3 rounded-lg bg-purple-600 px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 hover:bg-purple-500"
          >
            {isRegistering ? "⏳ 登録中..." : "📥 登録"}
          </button>
        )}
      </div>
    </div>
  );
}

export function AdminSearchResults({
  results,
  registeredIds,
  registrationStates,
  registeringIds,
  selectedIds,
  onToggleSelect,
  onRegister,
}: {
  results: DmmItem[];
  registeredIds: Set<string>;
  registrationStates: Map<string, RegistrationState>;
  registeringIds: Set<string>;
  selectedIds: Set<string>;
  onToggleSelect: (contentId: string) => void;
  onRegister: (item: DmmItem) => void;
}) {
  return (
    <>
      {results.map((item) => (
        <AdminSearchResultCard
          key={item.content_id}
          item={item}
          registrationState={registrationStates.get(item.content_id)}
          isRegisteredId={registeredIds.has(item.content_id)}
          isRegistering={registeringIds.has(item.content_id)}
          selected={selectedIds.has(item.content_id)}
          onToggleSelect={onToggleSelect}
          onRegister={onRegister}
        />
      ))}
    </>
  );
}
