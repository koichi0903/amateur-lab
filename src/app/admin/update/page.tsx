"use client";

import { useEffect, useState } from "react";

import UpdateHeader from "./components/UpdateHeader";
import JobCard from "./components/JobCard";
import UpdateButtons from "./components/UpdateButtons";
import { JOB_REGISTRY } from "./jobRegistry";

type Job = {
  job_name: string;
  status: "completed" | "running" | "failed" | "idle";
  processed_count: number;
  total_count: number;
  last_product_id: string | null;
  last_product_title?: string;
};

type UpdateResponse = {
  success?: boolean;
  completed?: boolean;
  message?: string;
  processedCount?: number;
  totalCount?: number;
};

export default function UpdatePage() {
const [jobs, setJobs] = useState<Job[]>([]);
const [loading, setLoading] = useState(true);
const [runningAll, setRunningAll] = useState(false);

const [showIdleJobs, setShowIdleJobs] = useState(false);

const [startedAt] = useState(Date.now());
  
  
  const isUpdating = runningAll || jobs.some(
  (job) =>
    job.status === "running" &&
    job.job_name === "all"
);

  async function runUpdateUntilCompleted(
    url: string,
    label: string,
  ): Promise<UpdateResponse> {
    const MAX_REQUESTS = 200;

    for (let attempt = 0; attempt < MAX_REQUESTS; attempt++) {
      const res = await fetch(url, {
        method: "POST",
      });

      let data: UpdateResponse = {};

      try {
        data = (await res.json()) as UpdateResponse;
      } catch {
        if (!res.ok) {
          throw new Error(`${label}に失敗しました。`);
        }
      }

      if (!res.ok || data.success === false) {
        throw new Error(data.message ?? `${label}に失敗しました。`);
      }

      await loadJobs();

      if (data.completed !== false) {
        return data;
      }
    }

    throw new Error(`${label}の分割更新が上限回数を超えました。`);
  }

  async function handleUpdateAll() {
    const steps = [
      ["reserve", "予約作品更新"],
      ["new", "新作更新"],
      ["semiNew", "準新作更新"],
      ["old", "旧作更新"],
      ["sale", "セール更新"],
      ["endedSale", "終了セール更新"],
      ["stage", "Stage同期"],
      ["review", "レビュー更新"],
      ["ranking", "ランキング更新"],
      ["score", "スコア更新"],
    ] as const;

    setRunningAll(true);

    try {
      for (const [index, [step, label]] of steps.entries()) {
        try {
          await runUpdateUntilCompleted(
            `/api/update-all?step=${step}`,
            label,
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : `${label}に失敗しました。`;
          throw new Error(`${index + 1}/${steps.length} ${message}`);
        }
      }

      alert("全更新が完了しました。");
      await loadJobs();
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? `全更新を中断しました。\n${error.message}`
          : "全更新に失敗しました。",
      );
    } finally {
      setRunningAll(false);
    }
  }

  async function handleStop(jobName: string) {
    try {
      const response = await fetch("/api/admin/jobs/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobName }),
      });
      const data = (await response.json()) as {
        success?: boolean;
        message?: string;
      };

      if (!response.ok || data.success === false) {
        throw new Error(data.message ?? "停止に失敗しました。");
      }

      if (jobName === "all") setRunningAll(false);
      alert(data.message ?? "停止を受け付けました。");
      await loadJobs();
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "停止に失敗しました。");
    }
  }

async function handleUpdateNew() {
  try {
    const res = await fetch("/api/update-new", {
      method: "POST",
    });

    const data = await res.json();

    alert(data.message);

    await loadJobs();
  } catch (e) {
    console.error(e);
    alert("新作更新に失敗しました");
  } finally {
    setLoading(false);
  }
}

async function handleUpdateSemiNew() {

  try {
    const res = await fetch("/api/update-semi-new", {
      method: "POST",
    });

    const data = await res.json();

    alert(data.message);

    await loadJobs();
  } catch (e) {
    console.error(e);
    alert("準新作更新に失敗しました");
  } finally {
    setLoading(false);
  }
}

async function handleUpdateSale() {

  try {
    const res = await fetch("/api/update-sale", {
      method: "POST",
    });

    const data = await res.json();

    alert(data.message);

    await loadJobs();
  } catch (e) {
    console.error(e);
    alert("セール更新に失敗しました");
  } finally {
    setLoading(false);
  }
}

async function handleUpdateRanking() {

  try {
    const res = await fetch("/api/dmm-ranking", {
      method: "POST",
    });

    await res.json();

    alert("ランキング更新が完了しました");

    await loadJobs();
  } catch (e) {
    console.error(e);
    alert("ランキング更新に失敗しました");
  } finally {
    setLoading(false);
  }
}

async function handleUpdateOld() {

  try {
    const res = await fetch("/api/update-old", {
      method: "POST",
    });

    const data = await res.json();

    alert(data.message);

    await loadJobs();
  } catch (e) {
    console.error(e);
    alert("旧作更新に失敗しました");
  } finally {
    setLoading(false);
  }
}

async function handleUpdateEndedSale() {

  try {
    const res = await fetch("/api/update-ended-sale", {
      method: "POST",
    });

    const data = await res.json();

    alert(data.message);

    await loadJobs();
  } catch (e) {
    console.error(e);
    alert("終了セール更新に失敗しました");
  } finally {
    setLoading(false);
  }
}

async function handleUpdateScore() {

  try {
    const res = await fetch("/api/score-update", {
      method: "POST",
    });

    await res.json();

    alert("スコア更新が完了しました");

    await loadJobs();
  } catch (e) {
    console.error(e);
    alert("スコア更新に失敗しました");
  } finally {
    setLoading(false);
  }
}

async function handleUpdateReview() {

  try {
    const data = await runUpdateUntilCompleted(
      "/api/review-update",
      "レビュー更新",
    );

    alert(data.message ?? "レビュー更新完了");
    await loadJobs();
  } catch (e) {
    console.error(e);
    alert(
      e instanceof Error
        ? e.message
        : "レビュー更新に失敗しました",
    );
  } finally {
    setLoading(false);
  }
}

async function handleUpdateMissingPrices() {

  try {
    const res = await fetch("/api/update-missing-prices", {
      method: "POST",
    });

    const data = await res.json();

    alert(data.message);

    await loadJobs();
  } catch (e) {
    console.error(e);
    alert("価格補完に失敗しました");
  } finally {
    setLoading(false);
  }
}

async function handleFillSampleMovie() {

  try {
    const res = await fetch("/api/admin/fill-sample-movie", {
      method: "POST",
    });

    const data = await res.json();

    alert(
      `動画URL補完完了\n成功:${data.success}件\n失敗:${data.failed}件`
    );

    await loadJobs();
  } catch (e) {
    console.error(e);
    alert("動画URL補完に失敗しました");
  } finally {
    setLoading(false);
  }
}

async function handleUpdateReserve() {

  try {
    const res = await fetch("/api/update-reserve", {
      method: "POST",
    });

    const data = await res.json();

    alert(data.message);

    await loadJobs();
  } catch (e) {
    console.error(e);
    alert("予約作品更新に失敗しました");
  } finally {
    setLoading(false);
  }
}

async function handleUpdateStage() {

  try {
    const res = await fetch("/api/sync/update-stage", {
      method: "POST",
    });

    const data = await res.json();

    alert(data.message);

    await loadJobs();
  } catch (e) {
    console.error(e);
    alert("Stage同期に失敗しました");
  } finally {
    setLoading(false);
  }
}



  async function loadJobs() {
    try {
      const response = await fetch("/api/admin/jobs", { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load jobs");

      const payload = (await response.json()) as { jobs?: Job[] };
      setJobs(payload.jobs ?? []);
    } catch (error) {
      console.error(error);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
  void loadJobs();

  const interval = setInterval(() => {
    void loadJobs();
  }, 5000);

  return () => clearInterval(interval);
}, []);

const idleJobCount = jobs.filter(
  (job) => job.status === "idle" && job.total_count === 0
).length;

  return (
    <main className="min-h-screen bg-zinc-950">
      <div className="mx-auto max-w-7xl p-10">

        <UpdateHeader />

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
  {jobs
  .filter((job) => job.job_name !== "sale_scan")
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
  startedAt={startedAt}
/>
    ))}
</div>
        )}

  

        <div className="mt-10">
  <UpdateButtons
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
onFillSampleMovie={handleFillSampleMovie}
onUpdateReserve={handleUpdateReserve}
  isUpdating={isUpdating}
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
