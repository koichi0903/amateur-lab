"use client";

import UpdateHeader from "./components/UpdateHeader";
import JobCard from "./components/JobCard";
import UpdateButtons from "./components/UpdateButtons";
import ScheduleStatusPanel from "./components/ScheduleStatusPanel";
import { JOB_REGISTRY } from "./jobRegistry";
import useUpdatePageController from "./useUpdatePageController";

export default function UpdatePage() {
  const {
    jobs, loading, runningAll, refreshingCache, showIdleJobs, setShowIdleJobs, idleJobCount, displayedJobs,
    handleRunSchedule, handleUpdateStage, handleUpdateNew, handleUpdateSemiNew, handleUpdateOld, handleUpdateEndedSale,
    handleUpdateAll, handleUpdateSale, handleUpdateRanking, handleUpdateScore, handleUpdateReview, handleUpdateMissingPrices,
    handleFillSampleMovies, handleUpdateActressProfiles, handleUpdateReserve, handleRefreshPublicCache, isUpdating, handleStop,
  } = useUpdatePageController();
  return (
    <main className="min-h-screen bg-zinc-950">
      <div className="mx-auto max-w-7xl p-10">

        <UpdateHeader />

        <ScheduleStatusPanel />

        {idleJobCount > 0 && (
  <div className="mb-6">
    <button
      onClick={() => setShowIdleJobs((prev) => !prev)}
      className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800"
    >
      {showIdleJobs
        ? "▲ 待機中ジョブを隠す"
        : `▼ 待機中ジョブを表示（${idleJobCount}件）`}
    </button>
  </div>
)}

        {loading ? (
          <div className="py-20 text-center text-zinc-400">
            読み込み中...
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
  {displayedJobs
.filter(
  (job) =>
    showIdleJobs ||
    job.status !== "idle" ||
    job.total_count > 0
)
    .sort((a, b) => {
  return (
    (JOB_REGISTRY[
      a.job_name as keyof typeof JOB_REGISTRY
    ]?.order ?? 999) -
    (JOB_REGISTRY[
      b.job_name as keyof typeof JOB_REGISTRY
    ]?.order ?? 999)
  );
})
    .map((job) => (
      <JobCard
  key={job.job_name}
  title={
  JOB_REGISTRY[
    job.job_name as keyof typeof JOB_REGISTRY
  ]?.title ?? job.job_name
}
  status={job.status}
  processed={job.processed_count}
  total={job.total_count}
  lastProductId={job.last_product_id}
  lastProductTitle={job.last_product_title}
  progressPhase={job.progress_phase}
  phaseProcessed={job.phase_processed}
  phaseTotal={job.phase_total}
  errorMessage={job.error_message}
  startedAt={job.started_at}
  finishedAt={job.finished_at}
/>
    ))}
</div>
        )}

  

        <div className="mt-10">
        <UpdateButtons
  onRunSchedule={handleRunSchedule}
  onUpdateStage={handleUpdateStage}
  onUpdateNew={handleUpdateNew}
  onUpdateSemiNew={handleUpdateSemiNew}
  onUpdateOld={handleUpdateOld}
  onUpdateEndedSale={handleUpdateEndedSale}
  onUpdateAll={handleUpdateAll}
  onUpdateSale={handleUpdateSale}
  onUpdateRanking={handleUpdateRanking}
  onUpdateScore={handleUpdateScore}
onUpdateReview={handleUpdateReview}
onUpdateMissingPrices={handleUpdateMissingPrices}
onFillSampleMovies={handleFillSampleMovies}
onUpdateActressProfiles={handleUpdateActressProfiles}
onUpdateReserve={handleUpdateReserve}
onRefreshPublicCache={handleRefreshPublicCache}
  isUpdating={isUpdating}
  isRefreshingCache={refreshingCache}
  runningJobs={[
    ...jobs
      .filter((job) => job.status === "running")
      .map((job) => job.job_name),
    ...(runningAll ? ["all"] : []),
  ]}
  onStop={handleStop}
/>
</div>

      </div>
    </main>
  );

}
