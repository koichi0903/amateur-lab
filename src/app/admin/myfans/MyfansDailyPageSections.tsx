import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { MyfansAnalytics } from "@/lib/myfansAnalytics";
import { buildMyfansExecutionBoard } from "@/lib/myfansXExecution";
import { type MyfansStrategyConfig, MARKET_PATTERN_KEYS } from "@/lib/myfansStrategy";
import { readMarketWinnerOpportunities } from "@/lib/myfansMarketWinnerServer";
import { AffiliatePasteImportForm, DailyPlanReevaluateButton, MarketWinnerGenerateButton, QuoteRefreshBatchPanel } from "./MyfansAdminForms";

type DailyBoard = ReturnType<typeof buildMyfansExecutionBoard>;
type MarketWinnerData = Awaited<ReturnType<typeof readMarketWinnerOpportunities>>;
type SupplyProduct = { id: number; product_url: string; affiliate_url: string | null };
type SupplyEvidence = {
  confidence: string;
  discovered_myfans_url: string | null;
  final_myfans_url: string | null;
  product_id: number | null;
  verified_at: string | null;
};

export function MyfansAnalyticsLoadError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <section className="mt-8 rounded-lg border border-amber-800 bg-amber-950/30 p-5 text-sm leading-6 text-amber-200">
      myfansデータを読み込めません。Supabaseへの接続またはmyfansテーブルの状態を確認してください。
      <span className="mt-2 block text-xs text-amber-100/70">詳細: {error}</span>
    </section>
  );
}

export function MyfansMarketWinnerNotice({ strategyType }: { strategyType: MyfansStrategyConfig["strategyType"] }) {
  if (strategyType !== "MARKET_WINNER") return null;
  return <p className="mt-5 rounded-lg border border-violet-900 bg-violet-950/20 p-4 text-sm text-violet-100">4×3 Execution Boardは下の既存Quality Gateを再利用し、共有供給をID5のOpportunity/Guard評価後に候補として表示します。Xライブ操作はこの検証では実行していません。</p>;
}

export function MyfansQuoteRefreshSection({ strategyType, approvedMediaId }: { strategyType: MyfansStrategyConfig["strategyType"]; approvedMediaId: number | null }) {
  if (strategyType !== "SOURCE") return null;
  return <QuoteRefreshBatchPanel approvedMediaId={approvedMediaId} />;
}

export function MyfansPageHeader({
  strategy,
  media,
  selectedMedia,
  selectedMediaId,
}: {
  strategy: MyfansStrategyConfig;
  media: MyfansAnalytics["media"];
  selectedMedia: MyfansAnalytics["selectedMedia"];
  selectedMediaId: MyfansAnalytics["selectedMediaId"];
}) {
  return (
    <div className="mt-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-xs font-black tracking-[0.18em] text-emerald-300">MYFANS DAILY OPERATIONS / {strategy.strategyType}</p>
        <h1 className="mt-2 text-3xl font-black sm:text-5xl">myfans 今日の運用</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
          {(selectedMedia?.media_name ?? strategy.handle) || "選択中メディア"} / {strategy.label}。候補収集、X投稿、投稿URL登録、学習、成果確認までをこのページにまとめています。
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {media.map((item) => (
          <Link key={item.id} href={`/admin/myfans?media=${item.id}`} className={`rounded-lg px-3 py-2 text-xs font-black ${selectedMediaId === item.id ? "bg-emerald-500 text-black" : "bg-zinc-900 text-zinc-300"}`}>
            {item.media_name}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function MyfansDailyStatusSection({
  analytics,
  board,
  persistedSnapshot,
  summary,
  quoteTaskCount,
  dateTime,
}: {
  analytics: MyfansAnalytics;
  board: DailyBoard;
  persistedSnapshot: { planId: number; revision: number | null; evaluatedAt: string | null } | null;
  summary: { optionCount: number; selectedCount: number; selectedStatus: "READY" | "SUPPLY_INSUFFICIENT"; postCount: number };
  quoteTaskCount: number;
  dateTime: (value: string | null | undefined) => string;
}) {
  return (
    <section className="mt-8 rounded-xl border border-emerald-700 bg-emerald-950/25 p-5" aria-labelledby="myfans-status-title">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black tracking-[0.16em] text-emerald-300">TODAY AT A GLANCE</p>
          <h2 id="myfans-status-title" className="mt-2 text-2xl font-black">今日の状態</h2>
        </div>
        <div className="text-right text-xs text-zinc-400">
          <p>{board.planDate} JST / {board.todayStrategy.stageLabel}</p>
          {persistedSnapshot && <p className="mt-1 text-emerald-300">保存済み plan {persistedSnapshot.planId} / revision {persistedSnapshot.revision ?? "-"} / {dateTime(persistedSnapshot.evaluatedAt)}</p>}
          {!persistedSnapshot && <p className="mt-1 text-amber-300">live preview（未保存）</p>}
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <MetricCard label="投稿候補 options" value={`${summary.optionCount}/${board.recovery.candidateOptionsTarget}`} note="全eligible pool / 4 slot × A/B/C" />
        <MetricCard label="今日 selected" value={`${summary.selectedCount}/${board.recovery.selectedMinimum}〜${board.recovery.selectedMaximum}`} note={summary.selectedStatus === "READY" ? "投稿候補あり" : "供給不足"} />
        <MetricCard label="収集推奨" value={`${quoteTaskCount}件`} note="全クリエイター巡回" />
        <MetricCard label="投稿候補" value={`${summary.postCount}本`} note={persistedSnapshot ? "保存済みselected" : board.heldCandidates.length ? `保留 ${board.heldCandidates.length}本` : "Quality Gate通過"} />
        <MetricCard label="投稿後入力" value={analytics.posts.some((post) => post.status === "ready") ? "投稿URL" : "候補保存"} note="URL・24h指標" />
        <MetricCard label="最新収集" value={dateTime(board.quotePool.funnel.latestCollectedAt)} note="Companion保存時刻" />
      </div>
    </section>
  );
}

export function MyfansMarketWinnerSection({
  strategy,
  marketWinner,
  approvedMediaId,
  postCount,
}: {
  strategy: MyfansStrategyConfig;
  marketWinner: MarketWinnerData | null;
  approvedMediaId: number;
  postCount: number;
}) {
  if (strategy.strategyType !== "MARKET_WINNER") return null;
  return (
    <section className="mt-8 rounded-xl border border-fuchsia-800 bg-fuchsia-950/20 p-5" aria-labelledby="market-winner-title">
      <p className="text-xs font-black tracking-[0.16em] text-fuchsia-300">MARKET WINNER FOUNDATION</p>
      <h2 id="market-winner-title" className="mt-2 text-2xl font-black">{strategy.label}</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-300">{strategy.description}。競合観察からの初期Patternは実績ではなく仮説priorです。</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {MARKET_PATTERN_KEYS.map((key) => <span key={key} className="rounded-full bg-zinc-950 px-3 py-1.5 text-xs font-bold text-fuchsia-100">{key}</span>)}
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-zinc-950 p-3"><p className="text-xs text-zinc-500">Today&apos;s Winners</p><p className="mt-1 text-2xl font-black text-fuchsia-200">{marketWinner?.opportunities.length ?? 0}</p><p className="text-xs text-zinc-500">guard通過済み</p></div>
        <div className="rounded-lg bg-zinc-950 p-3"><p className="text-xs text-zinc-500">Shared Supply</p><p className="mt-1 text-2xl font-black text-fuchsia-200">{marketWinner?.sharedSupplyCount ?? 0}</p><p className="text-xs text-zinc-500">コピーなし・参照のみ</p></div>
        <div className="rounded-lg bg-zinc-950 p-3"><p className="text-xs text-zinc-500">Pattern Learning</p><p className="mt-1 text-2xl font-black text-fuchsia-200">{marketWinner?.patternCount ?? 0}/9</p><p className="text-xs text-zinc-500">初期priorは仮説</p></div>
      </div>
      <div className="mt-5">
        <p className="text-sm font-black text-fuchsia-100">Today&apos;s Winners / score理由</p>
        {marketWinner?.opportunities.length ? <div className="mt-3 grid gap-3 lg:grid-cols-2">{marketWinner.opportunities.slice(0, 6).map((item) => <article key={item.id || `${item.patternKey}:${item.sourceXUrl}`} className="rounded-lg border border-fuchsia-900 bg-zinc-950 p-4">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black text-fuchsia-300">{item.patternKey} / {item.patternName}</p><p className="mt-1 text-sm font-bold text-white">{item.productTitle}</p></div><span className="rounded-full bg-fuchsia-400 px-2.5 py-1 text-xs font-black text-black">{item.winnerScore.toFixed(1)}</span></div>
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-400">{item.sourceExcerpt || "元投稿テキストなし"}</p>
          <p className="mt-2 text-xs text-zinc-500">{item.creatorName} / {item.explanation.objective as string} / {item.guard.reasons.length ? item.guard.reasons.join(", ") : "guardなし"}</p>
          <a className="mt-2 block truncate text-xs text-cyan-300 hover:underline" href={item.sourceXUrl} rel="noreferrer">引用元: {item.sourceXUrl}</a>
        </article>)}</div> : <p className="mt-3 rounded-lg bg-zinc-950 p-4 text-sm text-zinc-400">保存済みWinner候補はありません。「Winner候補を生成・更新」を押した時だけ生成・保存されます。</p>}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3"><MarketWinnerGenerateButton approvedMediaId={approvedMediaId} /><p className="text-xs text-zinc-500">Shared Supplyを参照し、Pattern・Guard・scoreを計算してID5のOpportunitiesだけをupsertします。ページ表示では保存しません。</p></div>
      {postCount === 0 && <p className="mt-4 rounded-lg bg-zinc-950 p-4 text-sm text-zinc-400">ID5の投稿履歴はまだありません。Pattern候補・Opportunity生成後にここへ表示します。</p>}
    </section>
  );
}

export function MyfansNextActions({ strategyType, approvedMediaId }: { strategyType: MyfansStrategyConfig["strategyType"]; approvedMediaId: number }) {
  const isSource = strategyType === "SOURCE";
  return (
    <section className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-black tracking-[0.16em] text-amber-300">NEXT ACTIONS</p>
          <h2 className="mt-2 text-2xl font-black">今日やること</h2>
        </div>
        <p className="text-xs text-zinc-500">上から順に、必要なものだけ実行します。</p>
      </div>
      <div className={`mt-4 grid gap-3 ${isSource ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
        {isSource ? <>
          <a href="#collection" className="rounded-lg border border-emerald-800 bg-zinc-950 p-4 transition hover:border-emerald-500"><p className="text-sm font-black text-emerald-200">1. Source候補を更新</p><p className="mt-2 text-xs leading-5 text-zinc-400">Xプロフィールを開き、Companionで収集した候補を保存します。</p></a>
          <a href="#today-candidates" className="rounded-lg border border-violet-800 bg-zinc-950 p-4 transition hover:border-violet-500"><p className="text-sm font-black text-violet-200">2. 4×3を再評価・保存</p><p className="mt-2 text-xs leading-5 text-zinc-400">Source更新後の候補からDaily Planを保存します。</p></a>
          <a href="#today-candidates" className="rounded-lg border border-cyan-800 bg-zinc-950 p-4 transition hover:border-cyan-500"><p className="text-sm font-black text-cyan-200">3. 投稿候補を選ぶ／投稿準備</p><p className="mt-2 text-xs leading-5 text-zinc-400">4 Slot × 最大3から候補を選びます。</p></a>
        </> : <>
          <a href="#market-winner-title" className="rounded-lg border border-emerald-800 bg-zinc-950 p-4 transition hover:border-emerald-500"><p className="text-sm font-black text-emerald-200">1. Shared Supplyを確認／更新</p><p className="mt-2 text-xs leading-5 text-zinc-400">更新はSOURCE側のCompanion/X収集を使います。</p></a>
          <a href="#market-winner-title" className="rounded-lg border border-fuchsia-800 bg-zinc-950 p-4 transition hover:border-fuchsia-500"><p className="text-sm font-black text-fuchsia-200">2. Winner候補を生成・更新</p><p className="mt-2 text-xs leading-5 text-zinc-400">押した時だけID5 Opportunitiesをupsertします。</p></a>
          <a href="#today-candidates" className="rounded-lg border border-violet-800 bg-zinc-950 p-4 transition hover:border-violet-500"><p className="text-sm font-black text-violet-200">3. 4×3を再評価・保存</p><p className="mt-2 text-xs leading-5 text-zinc-400">Daily Plan保存です。Winner生成とは別操作です。</p></a>
          <a href="#today-candidates" className="rounded-lg border border-cyan-800 bg-zinc-950 p-4 transition hover:border-cyan-500"><p className="text-sm font-black text-cyan-200">4. 投稿候補を選ぶ／投稿準備</p><p className="mt-2 text-xs leading-5 text-zinc-400">保存済み候補から投稿準備を行います。</p></a>
        </>}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <DailyPlanReevaluateButton approvedMediaId={approvedMediaId} />
        <p className="text-xs text-zinc-500">供給が足りない時だけ再評価します。外部収集・X投稿はこの画面から自動実行しません。</p>
      </div>
    </section>
  );
}

export function MyfansFunnelDiagnostics({ board }: { board: DailyBoard }) {
  if (board.recovery.candidateOptions >= board.recovery.candidateOptionsTarget) return null;
  return (
    <section className="mt-5 rounded-xl border border-amber-800 bg-amber-950/20 p-5" aria-labelledby="myfans-funnel-diagnostics-title">
      <p className="text-xs font-black tracking-[0.16em] text-amber-300">FUNNEL DIAGNOSTICS</p>
      <h2 id="myfans-funnel-diagnostics-title" className="mt-2 text-xl font-black">候補が足りない理由</h2>
      <p className="mt-2 text-sm leading-6 text-amber-50/80">収集件数ではなく、Dailyへ渡せる候補の件数です。商品未紐付けでもeligibleなquote sourceは発見候補として表示しますが、収益導線は作りません。</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-zinc-950 p-3 text-xs"><p className="text-zinc-500">quote DB</p><p className="mt-1 text-lg font-black">{board.quotePool.funnel.dbTotal}件</p></div>
        <div className="rounded-lg bg-zinc-950 p-3 text-xs"><p className="text-zinc-500">raw 14日以内</p><p className="mt-1 text-lg font-black">{board.quotePool.funnel.rawFresh14d}件</p></div>
        <div className="rounded-lg bg-zinc-950 p-3 text-xs"><p className="text-zinc-500">Hard eligible</p><p className="mt-1 text-lg font-black">{board.quotePool.funnel.hardEligible}件</p></div>
        <div className="rounded-lg bg-zinc-950 p-3 text-xs"><p className="text-zinc-500">ranked TOP12</p><p className="mt-1 text-lg font-black">{board.quotePool.funnel.ranked12}件</p></div>
        <div className="rounded-lg bg-zinc-950 p-3 text-xs"><p className="text-zinc-500">候補上限</p><p className="mt-1 text-lg font-black">{board.quotePool.funnel.candidatePoolLimit}件</p></div>
        <div className="rounded-lg bg-zinc-950 p-3 text-xs"><p className="text-zinc-500">今回のslot候補</p><p className="mt-1 text-lg font-black">{board.recovery.candidateOptions}件</p></div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {board.quotePool.funnel.rejectionReasons.slice(0, 8).map((reason) => <span key={reason.reason} className="rounded-full bg-zinc-950 px-3 py-1.5 text-xs font-bold text-zinc-300">{reason.reason}: {reason.count}</span>)}
      </div>
    </section>
  );
}

export function MyfansSupplyLoopStatus({
  latestRefreshJob,
  latestSuccessfulSupply,
  dateTime,
}: {
  latestRefreshJob: {
    candidates_saved?: number | null;
    collection_cycle_no?: number | null;
    cursor_after_order?: string | null;
    accounts_processed?: number | null;
    processed_creators?: number | null;
    complete_threads_found?: number | null;
    no_match?: number | null;
    stopped_reason?: string | null;
    status?: string | null;
    collector_version?: string | null;
    selection_note?: string | null;
  } | null;
  latestSuccessfulSupply: { completed_at?: string | null } | null;
  dateTime: (value: string | null | undefined) => string;
}) {
  const display = buildMyfansSupplyLoopDisplay(latestRefreshJob, latestSuccessfulSupply, dateTime);
  return (
    <section className="mt-5 rounded-xl border border-violet-900 bg-violet-950/15 p-5" aria-labelledby="myfans-supply-status-title">
      <p className="text-xs font-black tracking-[0.16em] text-violet-300">SUPPLY LOOP STATUS</p>
      <h2 id="myfans-supply-status-title" className="mt-2 text-xl font-black">上流供給の実行状態</h2>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-lg bg-zinc-950 p-3 text-xs"><p className="text-zinc-500">今回保存</p><p className="mt-1 text-lg font-black">{display.candidatesSaved}件</p></div>
        <div className="rounded-lg bg-zinc-950 p-3 text-xs"><p className="text-zinc-500">rotation</p><p className="mt-1 text-lg font-black">cycle {display.cycle} / cursor {display.cursor}</p></div>
        <div className="rounded-lg bg-zinc-950 p-3 text-xs"><p className="text-zinc-500">処理 / thread / no-match</p><p className="mt-1 text-lg font-black">{display.accountsProcessed} / {display.threadsFound} / {display.noMatch}</p></div>
        <div className="rounded-lg bg-zinc-950 p-3 text-xs"><p className="text-zinc-500">最終保存成功</p><p className="mt-1 text-lg font-black">{display.lastSaved}</p></div>
        <div className="rounded-lg bg-zinc-950 p-3 text-xs"><p className="text-zinc-500">停止理由</p><p className="mt-1 text-sm font-black">{display.stopReason}</p></div>
      </div>
      <p className="mt-3 text-xs leading-5 text-zinc-500">最新run: {display.latestRun}</p>
    </section>
  );
}

function buildMyfansSupplyLoopDisplay(
  job: Parameters<typeof MyfansSupplyLoopStatus>[0]["latestRefreshJob"],
  latestSuccessfulSupply: Parameters<typeof MyfansSupplyLoopStatus>[0]["latestSuccessfulSupply"],
  dateTime: Parameters<typeof MyfansSupplyLoopStatus>[0]["dateTime"],
) {
  return {
    ...getMyfansSupplyLoopCounts(job),
    lastSaved: dateTime(latestSuccessfulSupply?.completed_at ?? null),
    stopReason: getMyfansSupplyLoopStopReason(job),
    latestRun: getMyfansSupplyLoopRunLabel(job),
  };
}

function getMyfansSupplyLoopCounts(job: Parameters<typeof MyfansSupplyLoopStatus>[0]["latestRefreshJob"]) {
  if (!job) {
    return {
      candidatesSaved: 0,
      cycle: "-",
      cursor: "-",
      accountsProcessed: 0,
      threadsFound: 0,
      noMatch: 0,
    };
  }

  return {
    candidatesSaved: job.candidates_saved ?? 0,
    cycle: job.collection_cycle_no ?? "-",
    cursor: job.cursor_after_order ?? "-",
    accountsProcessed: job.accounts_processed ?? job.processed_creators ?? 0,
    threadsFound: job.complete_threads_found ?? 0,
    noMatch: job.no_match ?? 0,
  };
}

function getMyfansSupplyLoopStopReason(job: Parameters<typeof MyfansSupplyLoopStatus>[0]["latestRefreshJob"]) {
  return job?.stopped_reason ?? (job?.status === "completed" ? "正常完了" : job?.status ?? "未実行");
}

function getMyfansSupplyLoopRunLabel(job: Parameters<typeof MyfansSupplyLoopStatus>[0]["latestRefreshJob"]) {
  return job ? `${job.status} / ${job.collector_version ?? "collector version不明"} / ${job.selection_note ?? "rotation stateを使用"}` : "まだ供給runの記録がありません";
}

export function MyfansDailyDiagnostics({ board, hasPersistedSnapshot }: { board: DailyBoard; hasPersistedSnapshot: boolean }) {
  return (
    <details className="mt-5 rounded-xl border border-cyan-900 bg-cyan-950/15 p-5">
      <summary className="cursor-pointer list-none text-sm font-black text-cyan-200">{hasPersistedSnapshot ? "現在候補の再計算結果（read-only）" : "Daily候補診断（read-only）"}</summary>
      <p className="mt-3 text-xs leading-5 text-zinc-500">{hasPersistedSnapshot ? "保存済みDaily Snapshotは上の表示を正本とし、ここは再評価前のlive preview診断です。" : "ページ生成時の件数と理由コードだけを表示します。本文、リンク値、affiliate値は記録しません。"} freshnessはJST基準の14日以内。Source Value LOWはHard除外ではなくランキング減点です。</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-zinc-950 p-3 text-xs"><p className="text-zinc-500">JST日付</p><p className="mt-1 font-black text-white">{board.diagnostics.planDateJst}</p></div>
        <div className="rounded-lg bg-zinc-950 p-3 text-xs"><p className="text-zinc-500">raw DB / 14日以内</p><p className="mt-1 font-black text-white">{board.diagnostics.rawQuoteCount} / {board.diagnostics.rawFresh14dCount}</p></div>
        <div className="rounded-lg bg-zinc-950 p-3 text-xs"><p className="text-zinc-500">Hard eligible / ranked12</p><p className="mt-1 font-black text-white">{board.diagnostics.hardEligibleCount} / {board.diagnostics.ranked12Count}</p></div>
        <div className="rounded-lg bg-zinc-950 p-3 text-xs"><p className="text-zinc-500">fresh+cooldown</p><p className="mt-1 font-black text-white">{board.diagnostics.freshnessCooldownCount}</p></div>
        <div className="rounded-lg bg-zinc-950 p-3 text-xs"><p className="text-zinc-500">Source Value PASS / LOW</p><p className="mt-1 font-black text-white">{board.diagnostics.sourceValuePassCount} / {board.diagnostics.sourceValueLowCount}</p></div>
        <div className="rounded-lg bg-zinc-950 p-3 text-xs"><p className="text-zinc-500">qualified / IDs</p><p className="mt-1 font-black text-white">{board.diagnostics.qualifiedDiscoveryCount} / {board.diagnostics.qualifiedDiscoveryIds.join(", ") || "-"}</p></div>
        <div className="rounded-lg bg-zinc-950 p-3 text-xs"><p className="text-zinc-500">product / creator map</p><p className="mt-1 font-black text-white">{board.diagnostics.productLinkedCount} / {board.diagnostics.creatorMapHitCount}</p></div>
        <div className="rounded-lg bg-zinc-950 p-3 text-xs"><p className="text-zinc-500">growth / dedupe後</p><p className="mt-1 font-black text-white">{board.diagnostics.growthQuotePoolCount} / {board.diagnostics.postDedupeCount}</p></div>
        <div className="rounded-lg bg-zinc-950 p-3 text-xs"><p className="text-zinc-500">quality pass / hold</p><p className="mt-1 font-black text-white">{board.diagnostics.qualityGatePassCount} / {board.diagnostics.qualityGateHoldCount}</p></div>
        <div className="rounded-lg bg-zinc-950 p-3 text-xs"><p className="text-zinc-500">final options / selected</p><p className="mt-1 font-black text-white">{board.diagnostics.finalOptionCount} / {board.diagnostics.selectedCount}</p></div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {board.diagnostics.qualityGateHoldReasons.map((reason) => <span key={reason.reason} className="rounded-full bg-zinc-950 px-3 py-1.5 text-xs font-bold text-zinc-300">{reason.reason}: {reason.count}</span>)}
        {!board.diagnostics.qualityGateHoldReasons.length && <span className="text-xs text-zinc-500">Quality Gate holdなし</span>}
      </div>
    </details>
  );
}

export function MyfansProductSupplyPanel({
  products,
  evidenceRows,
  supplyStatus,
  targetPostUrls,
  hasReadError,
}: {
  products: readonly SupplyProduct[];
  evidenceRows: readonly SupplyEvidence[];
  supplyStatus: Readonly<Record<string, number>>;
  targetPostUrls: readonly string[];
  hasReadError: boolean;
}) {
  const productByUrl = new Map(products.map((product) => [product.product_url, product]));
  return (
    <details className="mt-8 rounded-xl border border-amber-800 bg-amber-950/20 p-5">
      <summary className="cursor-pointer list-none text-sm font-black text-amber-200">商品供給・UUID登録（必要な時だけ開く）</summary>
      <div className="mt-4">
        <p className="text-xs font-black text-amber-300">PRODUCT SUPPLY / RESOLVER</p>
        <h2 className="mt-2 text-2xl font-black">投稿UUIDから商品DB・送客状態</h2>
        <p className="mt-2 text-sm leading-6 text-amber-50/80">通常Chromeで表示確認した投稿だけを、canonical URL単位で重複防止して登録します。creator_idとaffiliate_urlは画面で厳格に確認できるまで空欄です。</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard label="商品DB" value={`${products.length}件`} note="myfans_products" />
          <MetricCard label="UUID解決済み・未登録" value={`${supplyStatus.resolved_unregistered ?? 0}件`} note="strong / 商品供給待ち" />
          <MetricCard label="商品登録済み" value={`${products.filter((item) => !item.affiliate_url).length}件`} note="affiliate未発行" />
          <MetricCard label="exact / ready" value={`${supplyStatus.exact_ready ?? 0}件`} note="Resolver exact" />
          <MetricCard label="未解決" value={`${supplyStatus.unresolved ?? 0}件`} note="推測登録なし" />
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {targetPostUrls.map((url) => {
            const product = productByUrl.get(url);
            const evidence = evidenceRows.filter((row) => row.final_myfans_url === url || row.discovered_myfans_url === url || row.product_id === product?.id).sort((a, b) => String(b.verified_at).localeCompare(String(a.verified_at)))[0];
            const label = evidence?.confidence === "exact" && product ? "exact / affiliate ready候補" : product ? "商品登録済み・affiliate未発行" : evidence?.confidence === "strong" ? "UUID解決済み・DB商品未登録" : "未登録";
            return <div key={url} className="rounded-lg bg-zinc-950 p-4 text-xs leading-5 text-zinc-300">
              <p className="font-black text-white">{label}</p>
              <p className="mt-1 break-all text-zinc-500">{url}</p>
              <p className="mt-1">product_id: {product?.id ?? "-"} / evidence: {evidence?.confidence ?? "-"} / affiliate: {product?.affiliate_url ? "あり" : "未発行"}</p>
              <a className="mt-2 inline-block font-black text-cyan-300 underline" href={url} target="_blank" rel="noreferrer">投稿をChromeで確認</a>
            </div>;
          })}
        </div>
        {hasReadError && <p className="mt-3 text-xs text-amber-200">供給状態の一部を読み込めません。migration適用後に再表示してください。</p>}
        <p className="mt-3 text-xs leading-5 text-zinc-500">次の操作: 上の投稿を通常Chromeで開き、最新版のCompanionで登録を押す。affiliate URLはmyfans管理画面で実際に発行・確認した場合だけ別途登録します。</p>
      </div>
    </details>
  );
}

export function MyfansAcquisitionPlanner({ planner }: { planner: ReturnType<typeof import("@/lib/myfansAcquisitionPlanner").buildMyfansAcquisitionPlanner> }) {
  return (
    <section className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black text-emerald-300">Candidate Acquisition Planner</p>
          <h2 className="mt-2 text-2xl font-black">今日どこから集めるか</h2>
        </div>
        <p className="text-xs text-zinc-500">1日の目安上限 {planner.dailyLimit}件。大量巡回はしません。</p>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {planner.tasks.map((task) => (
          <article key={task.id} className="rounded-lg bg-zinc-950 p-4">
            <p className="text-xs font-black text-emerald-300">{task.pool.toUpperCase()} / 進捗 {task.currentCount}/{task.currentCount + task.targetCount}件</p>
            <h3 className="mt-2 text-lg font-black">{task.route.label}</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-300">{task.reason}</p>
            <p className="mt-2 text-xs leading-5 text-zinc-500">{task.instruction}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href={task.route.url} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-xs font-black text-white"><ExternalLink size={15} /> myfansで開く</a>
              <span className="inline-flex h-10 items-center rounded-lg bg-zinc-900 px-3 text-xs font-black text-zinc-300">Companionで登録</span>
            </div>
          </article>
        ))}
        {!planner.tasks.length && <p className="text-sm text-zinc-500">候補収集より投稿と計測を優先できます。</p>}
      </div>
      <AffiliatePasteImportForm />
    </section>
  );
}

function MetricCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <p className="text-xs font-black text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-zinc-500">{note}</p>
    </div>
  );
}

