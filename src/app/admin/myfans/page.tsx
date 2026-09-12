import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { getMyfansAnalytics } from "@/lib/myfansAnalytics";
import { buildMyfansAcquisitionPlanner } from "@/lib/myfansAcquisitionPlanner";
import { ensureMyfansDailySnapshot } from "@/lib/myfansDailySnapshot";
import { buildCreatorPartnershipCandidates, buildMyfansExecutionBoard, buildQuoteCandidateCollectionTasks, compareByStrategy, summarizeTodayActions } from "@/lib/myfansXExecution";
import { AffiliatePasteImportForm, DailyPlanReevaluateButton, QuoteCandidateTasks, QuoteRefreshBatchPanel, XAccountMetricForm, XExecutionBoard } from "./MyfansAdminForms";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function yen(value: number) {
  return `¥${value.toLocaleString("ja-JP")}`;
}

function rate(value: number | null) {
  return value === null ? "-" : `${(value * 100).toFixed(2)}%`;
}

function dateTime(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", hour12: false });
}

function Card({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <p className="text-xs font-black text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-zinc-500">{note}</p>
    </div>
  );
}

export default async function MyfansDailyPage({
  searchParams,
}: {
  searchParams?: Promise<{ media?: string }>;
}) {
  const params = await searchParams;
  const selectedMediaId = params?.media ? Number(params.media) : null;
  const analytics = await getMyfansAnalytics({ approvedMediaId: Number.isFinite(selectedMediaId) ? selectedMediaId : null });
  const planner = buildMyfansAcquisitionPlanner(analytics);
  const board = buildMyfansExecutionBoard(analytics);
  const snapshot = analytics.error ? null : await ensureMyfansDailySnapshot(board);
  const todayActions = summarizeTodayActions(analytics);
  const quoteTasks = buildQuoteCandidateCollectionTasks(analytics);
  const creatorsWithX = analytics.creators.filter((creator) => creator.is_active && creator.creator_x_url);
  const creatorKeysWithX = new Set(creatorsWithX.map((creator) => creator.id));
  const quotePoolCreatorKeys = new Set(analytics.quoteCandidates.map((candidate) => candidate.creator_id ?? candidate.creator_x_url).filter(Boolean));
  const uncollectedCreatorCount = creatorsWithX.filter((creator) => !quotePoolCreatorKeys.has(creator.id)).length;
  const verifiedVisualQuotes = analytics.quoteCandidates.filter((candidate) => candidate.visual_analysis_status === "verified");
  const partialVisualQuotes = analytics.quoteCandidates.filter((candidate) => candidate.visual_analysis_status === "partial");
  const unavailableVisualQuotes = analytics.quoteCandidates.filter((candidate) => candidate.visual_analysis_status === "unavailable");
  const unanalyzedVisualQuotes = analytics.quoteCandidates.filter((candidate) => !candidate.visual_analysis_status);
  const verifiedVisualCreators = new Set(verifiedVisualQuotes.map((candidate) => candidate.creator_id ?? candidate.creator_x_url).filter(Boolean));
  const verifiedVisualVideos = verifiedVisualQuotes.filter((candidate) => candidate.media_type === "video").length;
  const verifiedVisualImages = verifiedVisualQuotes.filter((candidate) => candidate.media_type === "image").length;
  const visualAnalyzedAt = analytics.quoteCandidates
    .map((candidate) => candidate.visual_analyzed_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null;
  const visualReasonCounts = [...partialVisualQuotes, ...unavailableVisualQuotes].reduce<Record<string, number>>((acc, candidate) => {
    const raw = candidate.visual_analysis_json && typeof candidate.visual_analysis_json === "object" ? candidate.visual_analysis_json as Record<string, unknown> : {};
    const reason = String(raw.failure_reason || raw.failureReason || candidate.visual_render_status || "unknown").slice(0, 40);
    acc[reason] = (acc[reason] ?? 0) + 1;
    return acc;
  }, {});
  const yesterdaySourceUrls = new Set(
    analytics.posts
      .filter((post) => (post.created_at ?? "").slice(0, 10) === "2026-09-11" || (post.posted_at ?? "").slice(0, 10) === "2026-09-11")
      .map((post) => post.quote_x_url || post.source_x_url || "")
      .filter(Boolean),
  );
  const todaySourceReuse = board.candidates.filter((candidate) => candidate.quoteXUrl && yesterdaySourceUrls.has(candidate.quoteXUrl)).length;
  const topGlobalQuote = board.quotePool.global[0] ?? null;
  const strategyRows = compareByStrategy(analytics.posts, analytics.conversions);
  const creatorCandidates = buildCreatorPartnershipCandidates(analytics);
  const learningPanels = [
    { label: "7日 link", rows: board.learning.seven.link_strategy },
    { label: "7日 creative", rows: board.learning.seven.creative_strategy },
    { label: "30日 link", rows: board.learning.thirty.link_strategy },
    { label: "30日 creative", rows: board.learning.thirty.creative_strategy },
  ];

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/admin" className="text-sm font-bold text-zinc-400 transition hover:text-white">管理画面へ戻る</Link>
        <div className="mt-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black tracking-[0.18em] text-emerald-300">MYFANS DAILY OPERATIONS</p>
            <h1 className="mt-2 text-3xl font-black sm:text-5xl">myfans 今日の運用</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
              {analytics.selectedMedia?.media_name ?? "選択中メディア"}で、候補収集、X投稿、投稿URL登録、学習、成果確認までをこのページにまとめています。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {analytics.media.map((item) => (
              <Link key={item.id} href={`/admin/myfans?media=${item.id}`} className={`rounded-lg px-3 py-2 text-xs font-black ${analytics.selectedMediaId === item.id ? "bg-emerald-500 text-black" : "bg-zinc-900 text-zinc-300"}`}>
                {item.media_name}
              </Link>
            ))}
          </div>
        </div>

        {analytics.error && (
          <section className="mt-8 rounded-lg border border-amber-800 bg-amber-950/30 p-5 text-sm leading-6 text-amber-200">
            myfansデータを読み込めません。Supabaseへの接続またはmyfansテーブルの状態を確認してください。
            <span className="mt-2 block text-xs text-amber-100/70">詳細: {analytics.error}</span>
          </section>
        )}

        <section className="mt-8 rounded-lg border border-emerald-700 bg-emerald-950/25 p-5">
          <p className="text-xs font-black text-emerald-300">@lumi_reviw Daily Growth Command Center</p>
          <div className="mt-3 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
            <div>
              <h2 className="text-2xl font-black">Day {board.day} / {board.todayStrategy.stageLabel}</h2>
              <p className="mt-3 text-sm leading-7 text-emerald-50/85">{board.todayStrategy.winningNarrative}</p>
              <p className="mt-3 text-sm font-black text-white">今日の目標: {board.todayStrategy.kpi}</p>
              <p className="mt-2 text-xs leading-5 text-zinc-400">Plan: {board.planDate} / {board.planKey}</p>
              <p className="mt-2 text-sm font-black text-emerald-100">今日の計画: {board.planDate} JST</p>
              <p className="mt-1 text-xs leading-5 text-zinc-400">前日とは別の候補を再評価済み / 昨日と同じsource再利用 {todaySourceReuse}件 / 生成版 {board.planKey.split(":").at(-1)}</p>
              <p className="mt-1 text-xs leading-5 text-zinc-400">
                Snapshot: {snapshot ? `${snapshot.message} / ID ${snapshot.id ?? "-"} / revision ${snapshot.revision ?? "-"} / ${snapshot.postCount}本` : "未確認"}
              </p>
              <p className="mt-1 text-xs leading-5 text-zinc-400">最終再評価: {dateTime(snapshot?.evaluatedAt)}</p>
              <p className="mt-3 text-sm font-black text-emerald-100">目標{board.recovery.targetPosts}本 / 現在{board.recovery.passCount}本PASS</p>
              <p className="mt-1 text-xs leading-5 text-zinc-400">再探索: {board.recovery.attemptedCandidates}候補試行 / {board.recovery.summary}</p>
            </div>
            <div className="rounded-lg bg-zinc-950 p-4">
              <p className="text-xs font-black text-zinc-500">今日の構成</p>
              <p className="mt-2 text-sm font-black text-white">
                Quote {board.todayStrategy.composition.quote} / Discovery {board.todayStrategy.composition.discovery} / Authority {board.todayStrategy.composition.authority} / Revenue {board.todayStrategy.composition.revenue}
              </p>
              <p className="mt-3 text-xs leading-5 text-zinc-400">Quality Gate通過 {board.todayStrategy.composition.total}本。未達候補は無理に採用しません。</p>
              <div className="mt-4"><DailyPlanReevaluateButton /></div>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
            <Card label="Quote候補母集団" value={`${board.quotePool.funnel.loaded} / ${board.quotePool.funnel.dbTotal}`} note={board.quotePool.funnel.loadedAll ? `全件読込 / page ${board.quotePool.funnel.pageSize}` : "読込未完了"} />
            <Card label="Media対象" value={`${board.quotePool.funnel.mediaScoped}件`} note="選択メディア+共通候補" />
            <Card label="基本条件通過" value={`${board.quotePool.funnel.baseEligible}件`} note="freshness/cooldown/未使用" />
            <Card label="品質条件通過" value={`${board.quotePool.funnel.qualified}件`} note="visual/score/creator rank" />
            <Card label="verified visual" value={`${verifiedVisualQuotes.length}件`} note={`creator ${verifiedVisualCreators.size} / video ${verifiedVisualVideos} / image ${verifiedVisualImages}`} />
            <Card label="Topic Value通過" value={`${board.topicValue.funnel.topicValuePass}件`} note="話す価値あり" />
            <Card label="最終採用" value={`${board.candidates.filter((candidate) => candidate.creativeStrategy === "quote_post").length}件`} note="Daily Planner最終採用" />
          </div>
          <p className="mt-3 text-xs leading-5 text-zinc-500">
            最新候補取得: {dateTime(board.quotePool.funnel.latestCollectedAt)} / Companion selected_for_today は推奨印、Daily Planner採用はsnapshotのselectedとして別記録します。
          </p>
          <div className="mt-4 rounded-lg border border-cyan-800 bg-zinc-950 p-4">
            <p className="text-sm font-black text-cyan-100">Visual Verification</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <Card label="verified" value={`${verifiedVisualQuotes.length}件`} note={`creator ${verifiedVisualCreators.size}`} />
              <Card label="partial" value={`${partialVisualQuotes.length}件`} note="見えたが確証不足" />
              <Card label="unavailable" value={`${unavailableVisualQuotes.length}件`} note="表示不可/削除/認証等" />
              <Card label="未分析" value={`${unanalyzedVisualQuotes.length}件`} note="Companion分析待ち" />
              <Card label="image/video" value={`${verifiedVisualImages}/${verifiedVisualVideos}`} note="verified内訳" />
              <Card label="最終分析" value={dateTime(visualAnalyzedAt)} note="JST" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(visualReasonCounts).slice(0, 8).map(([reason, count]) => (
                <span key={reason} className="rounded-md bg-zinc-900 px-2 py-1 text-xs font-bold text-zinc-300">{reason}: {count}</span>
              ))}
              {!Object.keys(visualReasonCounts).length && <span className="text-xs text-zinc-500">partial/blocked理由はまだありません。</span>}
            </div>
          </div>
          <div className="mt-4 rounded-lg bg-zinc-950 p-4">
            <p className="text-xs font-black text-zinc-500">昨日から変えたこと</p>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {board.todayStrategy.changedFromYesterday.map((item) => (
                <p key={item} className="text-xs leading-5 text-zinc-300">{item}</p>
              ))}
            </div>
          </div>
          <details className="mt-4 rounded-lg border border-emerald-800 bg-zinc-950 p-4">
            <summary className="cursor-pointer text-sm font-black text-emerald-200">Recovery履歴を表示</summary>
            <div className="mt-4 grid gap-2 lg:grid-cols-2">
              {board.recovery.history.map((row, index) => (
                <p key={`${row.slot}-${row.attempt}-${row.candidateId}-${row.recoveryRole}-${index}`} className="text-xs leading-5 text-zinc-300">
                  {row.slot} / try {row.attempt} / {row.initialRole} → {row.recoveryRole} / {row.role} / {row.creative} / {row.score}点 / {row.verdict}: {row.holdReason || row.recoveryAction}
                </p>
              ))}
            </div>
          </details>
          <details className="mt-4 rounded-lg border border-emerald-800 bg-zinc-950 p-4">
            <summary className="cursor-pointer text-sm font-black text-emerald-200">Topic Value Top10を表示</summary>
            <div className="mt-4 grid gap-2 lg:grid-cols-2">
              {board.topicValue.top10.map((row) => (
                <div key={`${row.productId}-${row.role}-${row.quoteCandidateId ?? "noquote"}`} className="rounded-lg bg-zinc-900 p-3 text-xs leading-5 text-zinc-300">
                  <p className="font-black text-white">Topic Value {row.topicValue.score}/100 / {row.topicValue.verdict} / {row.role} / {row.topicValue.reasonToCare ?? "reasonなし"}</p>
                  <p className="mt-1 text-zinc-400">{row.title}</p>
                  <p className="mt-1">evidence: {row.topicValue.evidence.join(" / ") || "-"}</p>
                  <p className="mt-1 text-zinc-500">baseline: {row.topicValue.baseline.join(" / ") || "-"}</p>
                  {row.topicValue.whyRejected.length > 0 && <p className="mt-1 text-amber-200">reject: {row.topicValue.whyRejected.join(" / ")}</p>}
                </div>
              ))}
            </div>
          </details>
        </section>

        <section className="mt-8 rounded-lg border border-emerald-800 bg-emerald-950/20 p-5">
          <p className="text-xs font-black text-emerald-300">今日やること</p>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <div className="rounded-lg bg-zinc-950 p-4">
              <p className="text-sm font-black">収集タスク</p>
              <p className="mt-2 text-2xl font-black">{planner.tasks.length ? `${planner.tasks.length}件` : "なし"}</p>
              <p className="mt-1 text-xs leading-5 text-zinc-400">{planner.summary} / 引用候補 {quoteTasks.length}件</p>
            </div>
            <div className="rounded-lg bg-zinc-950 p-4">
              <p className="text-sm font-black">投稿タスク</p>
              <p className="mt-2 text-2xl font-black">{board.candidates.length}本</p>
              <p className="mt-1 text-xs leading-5 text-zinc-400">{board.strategy.postsPerDay} / {todayActions.join(" / ")}</p>
            </div>
            <div className="rounded-lg bg-zinc-950 p-4">
              <p className="text-sm font-black">必要な手入力</p>
              <p className="mt-2 text-2xl font-black">{analytics.posts.some((post) => post.status === "ready") ? "投稿URL" : "候補保存"}</p>
              <p className="mt-1 text-xs leading-5 text-zinc-400">投稿後にURL、表示、いいね、返信、クリックをここで登録します。</p>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-lg border border-violet-800 bg-violet-950/20 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black text-violet-300">Attention Radar</p>
              <h2 className="mt-2 text-2xl font-black">Xで指が止まりそうな候補を先に選ぶ</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-violet-50/80">
                creator内Top1-3だけを全creator横断ランキングに入れます。verified visualがないquoteはAttention枠に採用しません。
              </p>
            </div>
            <a href="#quote-refresh" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-violet-700 px-4 text-sm font-black text-white">
              <ExternalLink size={16} /> 一括更新へ
            </a>
          </div>
          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            {board.quotePool.global.slice(0, 3).map((row) => (
              <article key={row.candidate.id} className="rounded-lg bg-zinc-950 p-4">
                <p className="text-xs font-black text-violet-300">Attention Score {row.globalScore}</p>
                <h3 className="mt-2 text-sm font-black">{row.candidate.source_x_handle ? `@${row.candidate.source_x_handle}` : row.candidate.creator_x_url}</h3>
                <p className="mt-2 text-xs leading-5 text-zinc-400">media: {row.candidate.media_type ?? "none"} / visual: {row.candidate.quote_visual_ready ? "verified" : "not verified"} / creator rank {row.candidate.creator_rank ?? "-"}</p>
                <p className="mt-2 text-xs leading-5 text-zinc-300">{row.candidate.score_reason}</p>
                <a href={row.candidate.media_permalink || row.candidate.x_post_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-xs font-black text-cyan-300 underline">候補を開く</a>
              </article>
            ))}
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Card label="Xリンクありcreator" value={`${creatorKeysWithX.size}件`} note="商品数ではなくcreator単位" />
            <Card label="候補収集済creator" value={`${quotePoolCreatorKeys.size}件`} note="Quote候補保存済み" />
            <Card label="未収集creator" value={`${uncollectedCreatorCount}件`} note="X取得済みだが未スキャン" />
            <Card label="今日更新推奨" value={`${quoteTasks.length}件`} note="未収集/古い順に最大3creator" />
            <Card label="全体Top候補" value={topGlobalQuote ? `Score ${topGlobalQuote.globalScore}` : "なし"} note={topGlobalQuote?.candidate.source_x_handle ? `@${topGlobalQuote.candidate.source_x_handle}` : "閾値未満ならcard"} />
            <Card label="今日採用予定quote" value={`${board.candidates.filter((candidate) => candidate.creativeStrategy === "quote_post").length}件`} note="原則1件、強い別creatorなら最大2件" />
          </div>
          <QuoteRefreshBatchPanel approvedMediaId={analytics.selectedMediaId} />
        </section>

        <section className="mt-8 rounded-lg border border-cyan-800 bg-cyan-950/20 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black text-cyan-300">30日戦略</p>
              <h2 className="mt-2 text-2xl font-black">{board.strategy.label} / {board.strategy.postsPerDay}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-cyan-50/80">{board.strategy.focus}</p>
            </div>
            <div className="rounded-lg bg-zinc-950 p-4 text-sm">
              <p className="font-black text-white">{board.strategy.normalPrRatio}</p>
              <p className="mt-2 text-xs leading-5 text-zinc-400">{board.strategy.changeRule}</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(board.strategy.linkMix).map(([key, value]) => (
              <div key={key} className="rounded-lg bg-zinc-950 p-4">
                <p className="text-xs font-black text-zinc-500">{key}</p>
                <p className="mt-1 text-2xl font-black">{value}本</p>
              </div>
            ))}
          </div>
        </section>

        <QuoteCandidateTasks tasks={quoteTasks} />

        <section className="mt-8 rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-xs font-black text-emerald-300">プロフィールと固定ポスト</p>
          <h2 className="mt-2 text-2xl font-black">@lumi_reviwの受け皿</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">{board.profileGuide.role}</p>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <div className="rounded-lg bg-zinc-950 p-4">
              <p className="text-xs font-black text-zinc-500">表示名</p>
              <p className="mt-2 text-sm font-black">{board.profileGuide.displayName}</p>
            </div>
            <div className="rounded-lg bg-zinc-950 p-4 lg:col-span-2">
              <p className="text-xs font-black text-zinc-500">プロフィール文</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-200">{board.profileGuide.bio}</p>
            </div>
            <div className="rounded-lg bg-zinc-950 p-4 lg:col-span-3">
              <p className="text-xs font-black text-zinc-500">固定ポスト案</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-200">{board.profileGuide.pinnedPost}</p>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-lg border border-zinc-800 bg-zinc-900 p-5">
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
                  <a href={task.route.url} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-xs font-black text-white">
                    <ExternalLink size={15} /> myfansで開く
                  </a>
                  <span className="inline-flex h-10 items-center rounded-lg bg-zinc-900 px-3 text-xs font-black text-zinc-300">Companionで登録</span>
                </div>
              </article>
            ))}
            {!planner.tasks.length && <p className="text-sm text-zinc-500">候補収集より投稿と計測を優先できます。</p>}
          </div>
          <details className="mt-5 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
            <summary className="cursor-pointer text-sm font-black">確認済みの収集経路</summary>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {planner.routes.map((route) => (
                <div key={route.id} className="rounded-lg bg-zinc-900 p-4">
                  <p className="text-sm font-black">{route.label}</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">{route.confirmedSurface}</p>
                  <p className="mt-2 text-xs text-emerald-300">用途: {route.pools.join(" / ")} / 約{route.approximateItemsPerPage}件 / 重複{route.duplicateRisk}</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">{route.affiliateUrlAvailability}</p>
                </div>
              ))}
            </div>
          </details>
          <AffiliatePasteImportForm />
        </section>

        <section className="mt-8 rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-xs font-black text-emerald-300">今日のX投稿</p>
          <h2 className="mt-2 text-2xl font-black">Day {board.day} / {board.stage}</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-500">{board.planningReason}</p>
          {board.heldCandidates.length > 0 && (
            <div className="mt-4 rounded-lg border border-amber-800 bg-amber-950/30 p-4">
              <p className="text-sm font-black text-amber-200">HOLD {board.heldCandidates.length}本。本数を埋めるための投稿はしません。</p>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {board.heldCandidates.map((candidate) => (
                  <p key={`${candidate.postType}-${candidate.plannedSlot}`} className="text-xs leading-5 text-amber-100/80">
                    {candidate.plannedSlot} / {candidate.postType} / {candidate.quality.total}点: {candidate.quality.reasons.join(" / ")}
                  </p>
                ))}
              </div>
            </div>
          )}
        </section>
        <XExecutionBoard candidates={board.candidates} posts={analytics.posts} />

        <section className="mt-8 rounded-lg border border-fuchsia-800 bg-fuchsia-950/20 p-5">
          <p className="text-xs font-black text-fuchsia-300">Outbound Growth</p>
          <h2 className="mt-2 text-2xl font-black">今日参加する価値がある会話</h2>
          <p className="mt-2 text-sm leading-6 text-fuchsia-50/80">自動送信はしません。quoteや返信は、同文連投ではなく文脈を確認してから使います。</p>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {board.outboundTasks.map((task) => (
              <article key={task.id} className="rounded-lg bg-zinc-950 p-4">
                <p className="text-xs font-black text-fuchsia-300">{task.type} / {task.creator}</p>
                <p className="mt-2 text-sm leading-6 text-zinc-300">{task.reason}</p>
                <p className="mt-3 whitespace-pre-wrap rounded-lg bg-zinc-900 p-3 text-xs leading-5 text-zinc-200">{task.suggestedText}</p>
                <p className="mt-2 text-xs leading-5 text-zinc-500">{task.guardrail}</p>
                {task.targetUrl && <a href={task.targetUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-xs font-black text-cyan-300 underline">Xで確認</a>}
              </article>
            ))}
            {!board.outboundTasks.length && <p className="text-sm text-zinc-500">参加候補はまだありません。Quote Poolを更新すると表示されます。</p>}
          </div>
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-xs font-black text-zinc-500">30-Day Growth Map</p>
            <h2 className="mt-2 text-2xl font-black">現在のボトルネック: {board.bottleneck.current}</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              30日表示 {analytics.xAccountGrowth.impressions30d.toLocaleString("ja-JP")} / プロフィール遷移 {analytics.xAccountGrowth.profileVisits30d} / フォロー増 {analytics.xAccountGrowth.newFollows30d} / クリック {analytics.xAccountGrowth.clicks30d} / CV {analytics.xAccountGrowth.conversions30d}
            </p>
            <p className="mt-2 text-xs leading-5 text-zinc-500">{board.bottleneck.explanation}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-xs font-black text-zinc-500">Profile Funnel</p>
            <h2 className="mt-2 text-2xl font-black">{board.profileFunnel.diagnosis}</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-400">プロフィール: {board.profileFunnel.profileHealth} / 固定ポスト: {board.profileFunnel.fixedPostHealth}</p>
            <p className="mt-2 text-sm leading-6 text-zinc-400">訪問→フォロー率: {board.profileFunnel.visitToFollowRate === null ? "データ不足" : rate(board.profileFunnel.visitToFollowRate)}</p>
            <p className="mt-2 text-xs leading-5 text-zinc-500">{board.profileFunnel.recommendation}</p>
          </div>
        </section>

        <section className="mt-8 rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-xs font-black text-emerald-300">Yesterday Learning</p>
          <h2 className="mt-2 font-black">昨日わかったこと / 今日変えたこと</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">{board.todayStrategy.winningNarrative}</p>
          <p className="mt-2 text-xs leading-5 text-zinc-500">profile visits/followsは投稿へ厳密帰属できないため account-level estimate です。サンプル不足時は過学習しません。</p>
          <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
            {learningPanels.map(({ label, rows }) => (
              <div key={label} className="rounded-lg bg-zinc-950 p-4">
                <p className="text-sm font-black">{label}</p>
                <div className="mt-3 space-y-3">
                  {rows.slice(0, 5).map((row) => (
                    <div key={row.key} className="text-sm">
                      <p className="font-bold">{row.key} <span className="text-xs text-zinc-500">{row.verdict}</span></p>
                      <p className="text-xs text-zinc-500">CTR {rate(row.ctr)} / CVR {rate(row.cvr)} / 1000表示報酬 {yen(row.realizedRewardPer1000Impressions)}</p>
                    </div>
                  ))}
                  {!rows.length && <p className="text-sm text-zinc-500">まだ比較できる投稿ログがありません。</p>}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-xs font-black text-zinc-500">候補プール</p>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card label="Growth" value={`${planner.poolCounts.growth}件`} note={`目標 ${planner.targets.growth}件`} />
            <Card label="Revenue pool" value={`${planner.poolCounts.revenue}件`} note="正規URL+報酬条件あり" />
            <Card label="LTV" value={`${planner.poolCounts.ltv}件`} note={`目標 ${planner.targets.ltv}件`} />
            <Card label="正規URL付き" value={`${planner.poolCounts.affiliateReady}件`} note={`Revenue条件未達 ${planner.poolCounts.revenueUrlOnly}件`} />
          </div>
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-3">
          <Card label="直近30日 clicks" value={`${analytics.xAccountGrowth.clicks30d}`} note={`CTR ${rate(analytics.xAccountGrowth.ctr30d)}`} />
          <Card label="直近30日 CV" value={`${analytics.xAccountGrowth.conversions30d}`} note={`CVR ${rate(analytics.xAccountGrowth.cvr30d)}`} />
          <Card label="直近30日 reward" value={yen(analytics.xAccountGrowth.reward30d)} note={`EPC ${analytics.xAccountGrowth.epc30d === null ? "-" : yen(analytics.xAccountGrowth.epc30d)}`} />
        </section>

        <section className="mt-8 rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="font-black">Expected vs realized reward</h2>
          <div className="mt-4 space-y-3">
            {strategyRows.slice(0, 5).map((row) => (
              <div key={row.key} className="rounded-lg bg-zinc-950 p-4 text-sm">
                <p className="font-black">{row.key}</p>
                <p className="mt-1 text-xs text-zinc-500">投稿 {row.posts} / 表示 {row.impressions.toLocaleString("ja-JP")} / クリック {row.clicks} / 報酬 {yen(row.reward)} / 1000表示報酬 {yen(row.expectedRewardPer1000Impressions)}</p>
              </div>
            ))}
            {!strategyRows.length && <p className="text-sm text-zinc-500">成果比較は投稿ログ追加後に表示します。</p>}
          </div>
        </section>

        <section className="mt-8 rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="font-black">Partnership候補</h2>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {creatorCandidates.slice(0, 6).map((row) => (
              <details key={row.creator.id} className="rounded-lg bg-zinc-950 p-4">
                <summary className="cursor-pointer text-sm font-black">{row.creator.display_name} / {row.priority}</summary>
                <p className="mt-2 text-xs text-zinc-500">Revenue {row.revenueScore} / LTV {row.creatorLtvScore} / クリック {row.clicks} / 報酬 {yen(row.reward)}</p>
                <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-zinc-400">{row.messageDraft}</p>
              </details>
            ))}
            {!creatorCandidates.length && <p className="text-sm text-zinc-500">creator候補が増えると表示します。</p>}
          </div>
        </section>

        <section className="mt-8 rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="font-black">週次入力</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-500">X API同期は補助扱いです。無料運用では、週1回この入力だけで足ります。</p>
          <XAccountMetricForm media={analytics.media} />
        </section>
      </div>
    </main>
  );
}
