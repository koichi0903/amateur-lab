import Link from "next/link";
import { getMyfansAnalytics } from "@/lib/myfansAnalytics";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildMyfansAcquisitionPlanner } from "@/lib/myfansAcquisitionPlanner";
import { buildMyfansExecutionBoard, buildQuoteCandidateCollectionTasks } from "@/lib/myfansXExecution";
import { restorePersistedDailySnapshot } from "@/lib/myfansDailySnapshotView";
import { buildMyfansDailyBoardSummary, buildMyfansSupplyEvidenceStatus, parseMyfansDailyPageParams, selectCurrentMyfansDailyPlan } from "@/lib/myfansDailyPageProjection";
import { AffiliatePasteImportForm, PersistedDailyPlanBoard, QuickProductForm, QuoteCandidateTasks, XExecutionBoard } from "./MyfansAdminForms";
import { permanentRedirect } from "next/navigation";
import { getMyfansStrategy } from "@/lib/myfansStrategy";
import { readMarketWinnerOpportunities } from "@/lib/myfansMarketWinnerServer";
import {
  MyfansAnalyticsLoadError,
  MyfansAcquisitionPlanner,
  MyfansDailyDiagnostics,
  MyfansDailyStatusSection,
  MyfansFunnelDiagnostics,
  MyfansMarketWinnerSection,
  MyfansMarketWinnerNotice,
  MyfansNextActions,
  MyfansPageHeader,
  MyfansProductSupplyPanel,
  MyfansQuoteRefreshSection,
  MyfansSupplyLoopStatus,
} from "./MyfansDailyPageSections";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type MyfansSearchParams = { media?: string; date?: string };
type MyfansAnalytics = Awaited<ReturnType<typeof getMyfansAnalytics>>;
type MyfansBoard = ReturnType<typeof buildMyfansExecutionBoard>;
type MyfansStrategy = ReturnType<typeof getMyfansStrategy>;
type PersistedSnapshot = ReturnType<typeof restorePersistedDailySnapshot> | null;

const targetPostUrls = [
  "https://myfans.jp/posts/d9e79b79-c7d0-411d-a4b8-4c4744d2c3d4",
  "https://myfans.jp/posts/03ba5744-5376-47e7-94bb-d3b1f7ceeb99",
];

function dateTime(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", hour12: false });
}

async function ensureSelectedMedia(searchParams?: Promise<MyfansSearchParams>) {
  const params = await searchParams;
  if (params?.media) return params;
  const { data: defaultMedia } = await supabaseAdmin.from("myfans_approved_media").select("id").eq("status", "active").order("id", { ascending: true }).limit(1).maybeSingle();
  permanentRedirect(`/admin/myfans?media=${defaultMedia?.id ?? ""}`);
}

async function loadMarketWinner(strategy: MyfansStrategy, analytics: MyfansAnalytics) {
  if (strategy.strategyType !== "MARKET_WINNER" || !analytics.selectedMediaId) return null;
  return readMarketWinnerOpportunities(analytics, analytics.selectedMediaId);
}

function buildPersistedSnapshot(analytics: MyfansAnalytics, board: MyfansBoard, selectedMediaId: number | null) {
  const currentPlan = selectCurrentMyfansDailyPlan(analytics.dailyPlans, board.planDate, selectedMediaId);
  if (!currentPlan) return null;
  return restorePersistedDailySnapshot({
    id: currentPlan.id,
    planDate: currentPlan.plan_date,
    revision: currentPlan.revision,
    evaluatedAt: currentPlan.evaluated_at ?? currentPlan.updated_at ?? null,
    strategyJson: currentPlan.strategy_json,
    permanentExclusions: analytics.permanentExclusions,
  });
}

function buildDisplaySummary(persistedSnapshot: PersistedSnapshot, board: MyfansBoard) {
  return buildMyfansDailyBoardSummary({
    persistedSelectedCount: persistedSnapshot?.selectedCount ?? null,
    candidateOptions: board.candidateOptions,
    recovery: board.recovery,
    candidates: board.candidates,
  });
}

export default async function MyfansDailyPage({
  searchParams,
}: {
  searchParams?: Promise<MyfansSearchParams>;
}) {
  const params = await ensureSelectedMedia(searchParams);
  const { selectedMediaId, planDate } = parseMyfansDailyPageParams(params);
  const analytics = await getMyfansAnalytics({ approvedMediaId: Number.isFinite(selectedMediaId) ? selectedMediaId : null, includeCompleteDailyFunnelInputs: true });
  const strategy = getMyfansStrategy(selectedMediaId);
  const marketWinner = await loadMarketWinner(strategy, analytics);
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
  const supplyStatus = buildMyfansSupplyEvidenceStatus(supplyProducts, supplyEvidence);
  const planner = buildMyfansAcquisitionPlanner(analytics);
  const board = buildMyfansExecutionBoard(analytics, planDate ? { planDate } : {});
  const persistedSnapshot = buildPersistedSnapshot(analytics, board, selectedMediaId);
  const { optionCount: displayOptionCount, selectedCount: displaySelectedCount, selectedStatus: displaySelectedStatus, postCount: displayPostCount } = buildDisplaySummary(persistedSnapshot, board);
  const quoteTasks = buildQuoteCandidateCollectionTasks(analytics);


  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/admin" className="text-sm font-bold text-zinc-400 transition hover:text-white">管理画面へ戻る</Link>
        <MyfansPageHeader strategy={strategy} media={analytics.media} selectedMedia={analytics.selectedMedia} selectedMediaId={analytics.selectedMediaId} />

        <MyfansMarketWinnerSection
          strategy={strategy}
          marketWinner={marketWinner}
          approvedMediaId={analytics.selectedMediaId!}
          postCount={analytics.posts.length}
        />

        <MyfansAnalyticsLoadError error={analytics.error} />

        <MyfansDailyStatusSection
          analytics={analytics}
          board={board}
          persistedSnapshot={persistedSnapshot}
          summary={{ optionCount: displayOptionCount, selectedCount: displaySelectedCount, selectedStatus: displaySelectedStatus, postCount: displayPostCount }}
          quoteTaskCount={quoteTasks.length}
          dateTime={dateTime}
        />

        <MyfansMarketWinnerNotice strategyType={strategy.strategyType} />

        <MyfansNextActions strategyType={strategy.strategyType} approvedMediaId={selectedMediaId!} />

        <MyfansFunnelDiagnostics board={board} />

        <MyfansSupplyLoopStatus
          latestRefreshJob={latestRefreshJob}
          latestSuccessfulSupply={latestSuccessfulSupply}
          dateTime={dateTime}
        />

        <MyfansDailyDiagnostics board={board} hasPersistedSnapshot={Boolean(persistedSnapshot)} />

        <MyfansProductSupplyPanel
          products={supplyProducts}
          evidenceRows={supplyEvidence}
          supplyStatus={supplyStatus}
          targetPostUrls={targetPostUrls}
          hasReadError={Boolean(supplyProductsResult.error || supplyEvidenceResult.error)}
        />

        <MyfansQuoteRefreshSection strategyType={strategy.strategyType} approvedMediaId={selectedMediaId} />
        <QuoteCandidateTasks tasks={quoteTasks} />

        <MyfansAcquisitionPlanner planner={planner} />

        <div id="today-candidates" className="mt-8">
          <div id="post-metrics">
            {persistedSnapshot && <PersistedDailyPlanBoard snapshot={persistedSnapshot} />}
            <section className="mt-6 rounded-xl border border-violet-800 bg-violet-950/15 p-5" aria-labelledby="live-daily-options-title">
              <p className="text-xs font-black tracking-[0.16em] text-violet-300">TOP 12 POSTING OPTIONS</p>
              <h2 id="live-daily-options-title" className="mt-2 text-xl font-black">全eligible候補からの投稿候補（4 Slot × 最大3）</h2>
              <p className="mt-2 text-xs leading-5 text-zinc-400">保存済みDaily重点とは別に、現在の全作品・eligible quote/sourceから再計算した手動投稿候補です。投稿URL保存が成功するまでposted確定しません。</p>
            </section>
            <XExecutionBoard
              candidates={board.candidates}
              candidateOptions={board.candidateOptions}
              selectedOptions={board.selectedOptions}
              planDate={board.planDate}
              posts={analytics.posts}
              emptyStateFallback={<><AffiliatePasteImportForm /><QuickProductForm approvedMediaId={selectedMediaId} /></>}
            />
          </div>
        </div>

      </div>
    </main>
  );
}
