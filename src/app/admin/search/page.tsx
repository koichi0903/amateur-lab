"use client";
import {
  AdminSearchDiagnostics,
  AdminSearchProgress,
  AdminSearchResults,
  AdminSearchSelection,
} from "./AdminSearchSections";
import { useAdminSearchController } from "./useAdminSearchController";

export default function AdminSearchPage() {
  const {
    keyword, setKeyword, loading, registeredIds, registrationStates,
    searchError, searchMode, searchDiagnostics, registeringIds, selectedIds,
    progress, logs, showOnlyUnregistered, setShowOnlyUnregistered, displayResults,
    handleSearch, handleRegister, toggleSelect, selectAll, clearSelection,
    handleSelectedRegister, handleRegisterAll,
  } = useAdminSearchController();

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

        <AdminSearchProgress progress={progress} logs={logs} />

        <div className="mt-10">

          {searchError && (
            <div className="mb-4 rounded-lg border border-red-800 bg-red-950/50 p-4 text-sm text-red-200" role="alert">
              検索エラー：{searchError}
            </div>
          )}

          <p className="mb-4 text-zinc-400">

            検索結果：
{displayResults.length}件
            {!searchError && displayResults.length === 0 && searchMode && (
              <span className="ml-2 text-xs text-zinc-500">
                （FANZA / デジタル動画）
              </span>
            )}
          </p>

          <AdminSearchDiagnostics searchDiagnostics={searchDiagnostics} />

          <AdminSearchSelection
            showOnlyUnregistered={showOnlyUnregistered}
            onShowOnlyUnregisteredChange={setShowOnlyUnregistered}
            selectedCount={selectedIds.size}
            onSelectAll={selectAll}
            onClearSelection={clearSelection}
            onRegisterSelected={handleSelectedRegister}
            onRegisterAll={handleRegisterAll}
          />

          <AdminSearchResults
            results={displayResults}
            registeredIds={registeredIds}
            registrationStates={registrationStates}
            registeringIds={registeringIds}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onRegister={handleRegister}
          />

        </div>

      </div>
    </main>
  );
}
