import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { getMyfansAnalytics } from "@/lib/myfansAnalytics";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildMyfansAcquisitionPlanner } from "@/lib/myfansAcquisitionPlanner";
import { buildMyfansExecutionBoard, buildQuoteCandidateCollectionTasks } from "@/lib/myfansXExecution";
import { restorePersistedDailySnapshot } from "@/lib/myfansDailySnapshotView";
import { AffiliatePasteImportForm, DailyPlanReevaluateButton, PersistedDailyPlanBoard, QuoteCandidateTasks, XExecutionBoard } from "./MyfansAdminForms";
import { permanentRedirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  searchParams?: Promise<{ media?: string; date?: string }>;
}) {
  const params = await searchParams;
  if (!params?.media) {
    permanentRedirect("/admin/myfans?media=1");
  }
  const selectedMediaId = params?.media ? Number(params.media) : null;
  const planDate = params?.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : undefined;
  const analytics = await getMyfansAnalytics({ approvedMediaId: Number.isFinite(selectedMediaId) ? selectedMediaId : null });
  const [supplyProductsResult, supplyEvidenceResult, latestRefreshResult, latestSuccessfulSupplyResult] = await Promise.all([
    supabaseAdmin.from("myfans_products").select("id,title,product_url,affiliate_url,creator_id,price").order("created_at", { ascending: false }).limit(1000),
    supabaseAdmin.from("myfans_post_product_linkage_evidence").select("id,source_status_url,discovered_myfans_url,final_myfans_url,product_id,confidence,resolution_method,verified_at").order("verified_at", { ascending: false }).limit(1000),
    supabaseAdmin.from("myfans_quote_refresh_jobs").select("id,status,total_creators,processed_creators,success_creators,failed_creators,batch_size,created_at,started_at,completed_at,stopped_reason,collection_cycle_no,cursor_before_order,cursor_after_order,cycle_completed,accounts_processed,complete_threads_found,candidates_saved,no_match,retryable_errors,eligible_creators,selection_note,collector_version").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabaseAdmin.from("myfans_quote_refresh_jobs").select("id,status,completed_at,candidates_saved,collection_cycle_no,cursor_after_order,collector_version").gt("candidates_saved", 0).order("completed_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const supplyProducts = supplyProductsResult.data ?? [];
  const supplyEvidence = supplyEvidenceResult.data ?? [];
  const latestRefreshJob = latestRefreshResult.data;
  const latestSuccessfulSupply = latestSuccessfulSupplyResult.data;
  const supplyProductByUrl = new Map(supplyProducts.map((product) => [product.product_url, product]));
  const supplyStatus = supplyEvidence.reduce<Record<string, number>>((counts, evidence) => {
    const product = evidence.product_id ? supplyProducts.find((item) => item.id === evidence.product_id) : null;
    const key = evidence.confidence === "exact" && product ? "exact_ready" : product ? "registered_no_exact" : evidence.confidence === "strong" ? "resolved_unregistered" : "unresolved";
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
  const targetPostUrls = [
    "https://myfans.jp/posts/d9e79b79-c7d0-411d-a4b8-4c4744d2c3d4",
    "https://myfans.jp/posts/03ba5744-5376-47e7-94bb-d3b1f7ceeb99",
  ];
  const planner = buildMyfansAcquisitionPlanner(analytics);
  const board = buildMyfansExecutionBoard(analytics, planDate ? { planDate } : {});
  const currentPlan = analytics.dailyPlans
    .filter((plan) => plan.plan_date === board.planDate && plan.approved_media_id === selectedMediaId)
    .sort((a, b) => (b.revision ?? 0) - (a.revision ?? 0) || String(b.evaluated_at ?? b.updated_at ?? "").localeCompare(String(a.evaluated_at ?? a.updated_at ?? "")) || b.id - a.id)[0]
    ?? analytics.dailyPlans
      .filter((plan) => plan.plan_date === board.planDate && plan.approved_media_id === null)
      .sort((a, b) => (b.revision ?? 0) - (a.revision ?? 0) || String(b.evaluated_at ?? b.updated_at ?? "").localeCompare(String(a.evaluated_at ?? a.updated_at ?? "")) || b.id - a.id)[0]
    ?? null;
  const persistedSnapshot = currentPlan ? restorePersistedDailySnapshot({
    id: currentPlan.id,
    planDate: currentPlan.plan_date,
    revision: currentPlan.revision,
    evaluatedAt: currentPlan.evaluated_at ?? currentPlan.updated_at ?? null,
    strategyJson: currentPlan.strategy_json,
  }) : null;
  const liveOptionCount = board.candidateOptions.reduce((count, slot) => count + slot.candidates.length, 0);
  const displayOptionCount = liveOptionCount;
  const displaySelectedCount = persistedSnapshot?.selectedCount ?? board.recovery.passCount;
  const displaySelectedStatus = displaySelectedCount >= board.recovery.selectedMinimum ? "READY" : "SUPPLY_INSUFFICIENT";
  const displayPostCount = persistedSnapshot?.selectedCount ?? board.candidates.length;
  const quoteTasks = buildQuoteCandidateCollectionTasks(analytics);


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
            <Card label="投稿候補 options" value={`${displayOptionCount}/${board.recovery.candidateOptionsTarget}`} note="全eligible pool / 4 slot × A/B/C" />
            <Card label="今日 selected" value={`${displaySelectedCount}/${board.recovery.selectedMinimum}〜${board.recovery.selectedMaximum}`} note={displaySelectedStatus === "READY" ? "投稿候補あり" : "供給不足"} />
            <Card label="収集推奨" value={`${quoteTasks.length}件`} note="全クリエイター巡回" />
            <Card label="投稿候補" value={`${displayPostCount}本`} note={persistedSnapshot ? "保存済みselected" : board.heldCandidates.length ? `保留 ${board.heldCandidates.length}本` : "Quality Gate通過"} />
            <Card label="投稿後入力" value={analytics.posts.some((post) => post.status === "ready") ? "投稿URL" : "候補保存"} note="URL・24h指標" />
            <Card label="最新収集" value={dateTime(board.quotePool.funnel.latestCollectedAt)} note="Companion保存時刻" />
          </div>
        </section>

        <section className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900 p-5" aria-labelledby="myfans-actions-title">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black tracking-[0.16em] text-amber-300">NEXT ACTIONS</p>
              <h2 id="myfans-actions-title" className="mt-2 text-2xl font-black">今日やること</h2>
            </div>
            <p className="text-xs text-zinc-500">上から順に、必要なものだけ実行します。</p>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <a href="#collection" className="rounded-lg border border-emerald-800 bg-zinc-950 p-4 transition hover:border-emerald-500">
              <p className="text-sm font-black text-emerald-200">1. {board.recovery.candidateOptions < board.recovery.candidateOptionsTarget ? "候補を補充" : "供給を確認"}</p>
              <p className="mt-2 text-xs leading-5 text-zinc-400">{planner.tasks.length ? `全クリエイター巡回から次の${Math.min(10, Math.max(5, planner.tasks.length))}件を収集` : "収集より投稿・計測を優先"} / cursor・cycleは自動保持</p>
            </a>
            <a href="#today-candidates" className="rounded-lg border border-violet-800 bg-zinc-950 p-4 transition hover:border-violet-500">
              <p className="text-sm font-black text-violet-200">2. {displaySelectedCount < board.recovery.selectedMinimum ? "候補を選ぶ" : "投稿準備"}</p>
              <p className="mt-2 text-xs leading-5 text-zinc-400">{displaySelectedCount}/{board.recovery.selectedMinimum}〜{board.recovery.selectedMaximum} selected / {persistedSnapshot ? "保存済みplanを表示中" : "A・B・Cから選択"}</p>
            </a>
            <a href="#post-metrics" className="rounded-lg border border-cyan-800 bg-zinc-950 p-4 transition hover:border-cyan-500">
              <p className="text-sm font-black text-cyan-200">3. {analytics.posts.some((post) => post.status === "ready") ? "投稿後を記録" : "投稿URLを保存"}</p>
              <p className="mt-2 text-xs leading-5 text-zinc-400">投稿URLを保存し、24時間後に5指標を入力</p>
            </a>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <DailyPlanReevaluateButton approvedMediaId={selectedMediaId ?? 1} />
            <p className="text-xs text-zinc-500">供給が足りない時だけ再評価します。外部収集・X投稿はこの画面から自動実行しません。</p>
          </div>
        </section>

        {board.recovery.candidateOptions < board.recovery.candidateOptionsTarget && (
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
        )}

        <section className="mt-5 rounded-xl border border-violet-900 bg-violet-950/15 p-5" aria-labelledby="myfans-supply-status-title">
          <p className="text-xs font-black tracking-[0.16em] text-violet-300">SUPPLY LOOP STATUS</p>
          <h2 id="myfans-supply-status-title" className="mt-2 text-xl font-black">上流供給の実行状態</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-lg bg-zinc-950 p-3 text-xs"><p className="text-zinc-500">今回保存</p><p className="mt-1 text-lg font-black">{latestRefreshJob?.candidates_saved ?? 0}件</p></div>
            <div className="rounded-lg bg-zinc-950 p-3 text-xs"><p className="text-zinc-500">rotation</p><p className="mt-1 text-lg font-black">cycle {latestRefreshJob?.collection_cycle_no ?? "-"} / cursor {latestRefreshJob?.cursor_after_order ?? "-"}</p></div>
            <div className="rounded-lg bg-zinc-950 p-3 text-xs"><p className="text-zinc-500">処理 / thread / no-match</p><p className="mt-1 text-lg font-black">{latestRefreshJob?.accounts_processed ?? latestRefreshJob?.processed_creators ?? 0} / {latestRefreshJob?.complete_threads_found ?? 0} / {latestRefreshJob?.no_match ?? 0}</p></div>
            <div className="rounded-lg bg-zinc-950 p-3 text-xs"><p className="text-zinc-500">最終保存成功</p><p className="mt-1 text-lg font-black">{dateTime(latestSuccessfulSupply?.completed_at ?? null)}</p></div>
            <div className="rounded-lg bg-zinc-950 p-3 text-xs"><p className="text-zinc-500">停止理由</p><p className="mt-1 text-sm font-black">{latestRefreshJob?.stopped_reason ?? (latestRefreshJob?.status === "completed" ? "正常完了" : latestRefreshJob?.status ?? "未実行")}</p></div>
          </div>
          <p className="mt-3 text-xs leading-5 text-zinc-500">最新run: {latestRefreshJob ? `${latestRefreshJob.status} / ${latestRefreshJob.collector_version ?? "collector version不明"} / ${latestRefreshJob.selection_note ?? "rotation stateを使用"}` : "まだ供給runの記録がありません"}</p>
        </section>

        <details className="mt-5 rounded-xl border border-cyan-900 bg-cyan-950/15 p-5">
          <summary className="cursor-pointer list-none text-sm font-black text-cyan-200">{persistedSnapshot ? "現在候補の再計算結果（read-only）" : "Daily候補診断（read-only）"}</summary>
          <p className="mt-3 text-xs leading-5 text-zinc-500">{persistedSnapshot ? "保存済みDaily Snapshotは上の表示を正本とし、ここは再評価前のlive preview診断です。" : "ページ生成時の件数と理由コードだけを表示します。本文、リンク値、affiliate値は記録しません。"} freshnessはJST基準の14日以内。Source Value LOWはHard除外ではなくランキング減点です。</p>
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

        <details className="mt-8 rounded-xl border border-amber-800 bg-amber-950/20 p-5">
          <summary className="cursor-pointer list-none text-sm font-black text-amber-200">商品供給・UUID登録（必要な時だけ開く）</summary>
          <div className="mt-4">
          <p className="text-xs font-black text-amber-300">PRODUCT SUPPLY / RESOLVER</p>
          <h2 className="mt-2 text-2xl font-black">投稿UUIDから商品DB・送客状態</h2>
          <p className="mt-2 text-sm leading-6 text-amber-50/80">通常Chromeで表示確認した投稿だけを、canonical URL単位で重複防止して登録します。creator_idとaffiliate_urlは画面で厳格に確認できるまで空欄です。</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Card label="商品DB" value={`${supplyProducts.length}件`} note="myfans_products" />
            <Card label="UUID解決済み・未登録" value={`${supplyStatus.resolved_unregistered ?? 0}件`} note="strong / 商品供給待ち" />
            <Card label="商品登録済み" value={`${supplyProducts.filter((item) => !item.affiliate_url).length}件`} note="affiliate未発行" />
            <Card label="exact / ready" value={`${supplyStatus.exact_ready ?? 0}件`} note="Resolver exact" />
            <Card label="未解決" value={`${supplyStatus.unresolved ?? 0}件`} note="推測登録なし" />
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {targetPostUrls.map((url) => {
              const product = supplyProductByUrl.get(url);
              const evidence = supplyEvidence.filter((row) => row.final_myfans_url === url || row.discovered_myfans_url === url || row.product_id === product?.id).sort((a, b) => String(b.verified_at).localeCompare(String(a.verified_at)))[0];
              const label = evidence?.confidence === "exact" && product ? "exact / affiliate ready候補" : product ? "商品登録済み・affiliate未発行" : evidence?.confidence === "strong" ? "UUID解決済み・DB商品未登録" : "未登録";
              return <div key={url} className="rounded-lg bg-zinc-950 p-4 text-xs leading-5 text-zinc-300">
                <p className="font-black text-white">{label}</p>
                <p className="mt-1 break-all text-zinc-500">{url}</p>
                <p className="mt-1">product_id: {product?.id ?? "-"} / evidence: {evidence?.confidence ?? "-"} / affiliate: {product?.affiliate_url ? "あり" : "未発行"}</p>
                <a className="mt-2 inline-block font-black text-cyan-300 underline" href={url} target="_blank" rel="noreferrer">投稿をChromeで確認</a>
              </div>;
            })}
          </div>
          {(supplyProductsResult.error || supplyEvidenceResult.error) && <p className="mt-3 text-xs text-amber-200">供給状態の一部を読み込めません。migration適用後に再表示してください。</p>}
          <p className="mt-3 text-xs leading-5 text-zinc-500">次の操作: 上の投稿を通常Chromeで開き、最新版のCompanionで登録を押す。affiliate URLはmyfans管理画面で実際に発行・確認した場合だけ別途登録します。</p>
          </div>
        </details>

        <QuoteCandidateTasks tasks={quoteTasks} />

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

        <div id="today-candidates" className="mt-8">
          <div id="post-metrics">
            {persistedSnapshot && <PersistedDailyPlanBoard snapshot={persistedSnapshot} />}
            <section className="mt-6 rounded-xl border border-violet-800 bg-violet-950/15 p-5" aria-labelledby="live-daily-options-title">
              <p className="text-xs font-black tracking-[0.16em] text-violet-300">TOP 12 POSTING OPTIONS</p>
              <h2 id="live-daily-options-title" className="mt-2 text-xl font-black">全eligible候補からの投稿候補（4 Slot × 最大3）</h2>
              <p className="mt-2 text-xs leading-5 text-zinc-400">保存済みDaily重点とは別に、現在の全作品・eligible quote/sourceから再計算した手動投稿候補です。投稿URL保存が成功するまでposted確定しません。</p>
            </section>
            <XExecutionBoard candidates={board.candidates} candidateOptions={board.candidateOptions} selectedOptions={board.selectedOptions} planDate={board.planDate} posts={analytics.posts} />
          </div>
        </div>

      </div>
    </main>
  );
}
