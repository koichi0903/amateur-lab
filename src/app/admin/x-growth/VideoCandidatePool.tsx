"use client";

import { useEffect, useState } from "react";

type VideoCandidate = {
  workId: number;
  title: string;
  sampleUrlOfficial: boolean;
  hardGatePassed: boolean;
  firstDropReason: string | null;
  rankingScore: number;
  freshnessScore: number;
  discountRate: number;
  saleEndAt: string | null;
  creativeQualityScore: number;
  lastPostedAt: string | null;
  rankScore: number;
  rankReasons: string[];
};

type SavedSelection = {
  account_handle: string;
  selected_work_ids: number[];
  manual_override_work_ids: number[];
  excluded_work_ids: number[];
  candidate_snapshot: {
    computedAt: string;
    evaluatedWorks: number;
    hardGatePassedWorks: number;
    candidates: VideoCandidate[];
    shortageReason: string | null;
    failureCounts: Record<string, number>;
    pipeline: Record<string, number>;
  };
  revision: number;
  updated_at: string;
};

type ApiResponse = { ok: boolean; selection: SavedSelection | null; error?: string; selectedCandidates?: VideoCandidate[] };

const CANDIDATES_PER_PAGE = 20;

export default function VideoCandidatePool() {
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [selection, setSelection] = useState<SavedSelection | null>(null);
  const [error, setError] = useState("");
  const [candidatePage, setCandidatePage] = useState(0);

  useEffect(() => {
    let active = true;
    void fetch("/api/admin/x-growth/video-candidates", { method: "GET", cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as ApiResponse;
        if (!response.ok || !data.ok) throw new Error(data.error ?? "保存済み候補を読み込めませんでした。");
        if (active) setSelection(data.selection);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "保存済み候補を読み込めませんでした。");
      })
      .finally(() => {
        if (active) setInitialLoading(false);
      });
    return () => { active = false; };
  }, []);

  const snapshot = selection?.candidate_snapshot ?? null;
  const selectedIds = selection?.selected_work_ids ?? [];
  const selectedSet = new Set(selectedIds);
  const candidates = snapshot?.candidates ?? [];
  const pageCount = Math.max(1, Math.ceil(candidates.length / CANDIDATES_PER_PAGE));
  const currentPage = Math.min(candidatePage, pageCount - 1);
  const visibleCandidates = candidates.slice(currentPage * CANDIDATES_PER_PAGE, (currentPage + 1) * CANDIDATES_PER_PAGE);

  function candidatePager() {
    if (candidates.length <= CANDIDATES_PER_PAGE) return null;
    const first = currentPage * CANDIDATES_PER_PAGE + 1;
    const last = Math.min((currentPage + 1) * CANDIDATES_PER_PAGE, candidates.length);
    return (
      <nav aria-label="動画候補ページ" className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2">
        <p aria-live="polite" className="text-xs font-bold text-zinc-300">{candidates.length}作品中 {first}〜{last}件を表示（{currentPage + 1}/{pageCount}ページ）</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => setCandidatePage((page) => Math.max(0, page - 1))} disabled={currentPage === 0} className="rounded border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-200 disabled:opacity-40">前へ</button>
          <button type="button" onClick={() => setCandidatePage((page) => Math.min(pageCount - 1, page + 1))} disabled={currentPage >= pageCount - 1} className="rounded border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-200 disabled:opacity-40">次へ</button>
        </div>
      </nav>
    );
  }

  async function save(action: "refresh" | "override" | "reset", selectedWorkIds?: number[]) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/x-growth/video-candidates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, expectedRevision: selection?.revision ?? 0, selectedWorkIds }),
      });
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.ok || !data.selection) throw new Error(data.error ?? "自動選定を保存できませんでした。");
      setSelection(data.selection);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "候補を保存できませんでした。");
    } finally {
      setLoading(false);
    }
  }

  function replaceWith(workId: number) {
    if (!selection || selectedSet.has(workId)) return;
    const next = selectedIds.length >= 5 ? [...selectedIds.slice(0, 4), workId] : [...selectedIds, workId];
    void save("override", next);
  }

  return (
    <section className="mt-6 rounded-xl border border-cyan-900 bg-cyan-950/10 p-4 text-white sm:p-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-black">動画候補の自動選定</h2>
          <p className="mt-1 text-sm text-zinc-300">動画Creative Quality Hard Gateを通過した作品から、スコア・鮮度・セール・直近投稿を使って上位5作品を選びます。</p>
        </div>
        <button type="button" onClick={() => void save("refresh")} disabled={loading || initialLoading} className="h-10 shrink-0 rounded-lg border border-cyan-700 bg-cyan-950 px-4 text-sm font-black text-cyan-100 disabled:opacity-60">
          {initialLoading ? "保存済み候補を読み込み中…" : loading ? "読み取り・自動選定・保存中…" : selection ? "候補を更新して自動選定" : "動画候補を自動選定"}
        </button>
      </div>
      <p className="mt-2 text-xs text-zinc-400">選定は専用保存先に記録します。Top Picks・投稿・Schedulerには反映しません。公式HTTPSサンプル動画URLはX掲載許可済みとして扱い、独自の許諾審査や追加除外条件は設けません。</p>
      {error && <p role="alert" className="mt-3 text-sm font-bold text-rose-300">{error}</p>}
      {snapshot && (
        <>
          <p className="mt-4 text-sm font-bold text-cyan-100">
            品質評価 {snapshot.evaluatedWorks}作品 / Hard Gate通過 {snapshot.hardGatePassedWorks}作品 / 保存中 {selectedIds.length}/5
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            候補 {snapshot.pipeline.candidateWorks ?? 0} → 品質評価 {snapshot.pipeline.qualityEvaluatedWorks ?? 0} / 最終評価 {new Date(snapshot.computedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
          </p>
          {snapshot.shortageReason && <p className="mt-2 text-sm font-bold text-amber-200">{snapshot.shortageReason} 品質基準は維持しています。</p>}
          {snapshot.hardGatePassedWorks < 10 && Object.keys(snapshot.failureCounts).length > 0 && <p className="mt-1 text-xs text-zinc-400">Gateの主な不合格理由: {Object.entries(snapshot.failureCounts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([reason, count]) => `${reason} ${count}`).join(" / ")}</p>}
          {candidatePager()}
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {visibleCandidates.map((candidate) => {
              const checked = selectedSet.has(candidate.workId);
              const manual = selection?.manual_override_work_ids.includes(candidate.workId) ?? false;
              return (
                <article key={candidate.workId} className={`rounded-lg border p-3 ${checked ? "border-emerald-600 bg-emerald-950/40" : "border-zinc-800 bg-zinc-950"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold">{candidate.title}</p>
                      <p className="mt-1 text-xs text-zinc-400">work {candidate.workId} · 自動スコア {candidate.rankScore.toFixed(1)} · 動画品質Gate合格</p>
                    </div>
                    {checked && <span className="shrink-0 rounded bg-emerald-900 px-2 py-1 text-xs font-bold text-emerald-200">{manual ? "手動入替" : "自動選定"}</span>}
                  </div>
                  <p className="mt-2 text-xs text-zinc-400">{candidate.rankReasons.join(" / ")}</p>
                  <div className="mt-2 flex items-center gap-3">
                    <a href={`/works/${candidate.workId}`} target="_blank" rel="noreferrer" className="text-xs text-cyan-300 underline">作品情報を開く</a>
                    {!checked && <button type="button" onClick={() => replaceWith(candidate.workId)} disabled={loading || !selection} className="rounded border border-zinc-700 px-2 py-1 text-xs font-bold text-zinc-200 disabled:opacity-50">この作品に入れ替え</button>}
                  </div>
                </article>
              );
            })}
          </div>
          {candidatePager()}
          {selection?.manual_override_work_ids.length || selection?.excluded_work_ids.length ? (
            <button type="button" onClick={() => void save("reset")} disabled={loading} className="mt-3 rounded border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-300 disabled:opacity-50">手動入替を解除して自動選定に戻す</button>
          ) : null}
          {!snapshot.hardGatePassedWorks && <p className="mt-3 text-sm text-amber-200">この評価ではHard Gate通過作品がありません。Gateを緩めず、表示された除外理由を確認してください。</p>}
        </>
      )}
      {!snapshot && !error && <p className="mt-4 text-sm text-zinc-400">まだ自動選定結果がありません。ボタンを押すと候補評価後に上位作品を専用保存先へ記録します。</p>}
    </section>
  );
}
