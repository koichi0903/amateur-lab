"use client";

import { useState } from "react";
import { JOB_REGISTRY } from "./jobRegistry";
import useUpdatePageJobs, { type UpdateJob } from "./useUpdatePageJobs";

type UpdateResponse = {
  success?: boolean;
  completed?: boolean;
  message?: string;
  processedCount?: number;
  totalCount?: number;
  nextOffset?: number | null;
};

const PUBLIC_CACHE_TASKS = [
  "reserve",
  "new",
  "semi-new",
  "old",
  "sale",
  "ended-sale",
  "stage",
  "review",
  "ranking",
  "score",
  "missing-prices",
  "sample-movie",
];

export default function useUpdatePageController() {
  const { jobs, loading, setLoading, loadJobs } = useUpdatePageJobs();
  const [runningAll, setRunningAll] = useState(false);
  const [refreshingCache, setRefreshingCache] = useState(false);

  const [showIdleJobs, setShowIdleJobs] = useState(false);

    async function revalidateAfterManualUpdate(tasks: string[]) {
      const response = await fetch("/api/admin/revalidate-production", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks }),
      });
      const result = (await response.json().catch(() => null)) as {
        success?: boolean;
        message?: string;
      } | null;
      if (!response.ok || result?.success === false) {
        throw new Error(result?.message ?? "本番キャッシュの更新に失敗しました");
      }
    }

    async function handleRefreshPublicCache() {
      setRefreshingCache(true);

      try {
        await revalidateAfterManualUpdate(PUBLIC_CACHE_TASKS);
        alert("公開ページのキャッシュ更新が完了しました。");
      } catch (error) {
        console.error(error);
        alert(
          error instanceof Error
            ? error.message
            : "公開ページのキャッシュ更新に失敗しました。",
        );
      } finally {
        setRefreshingCache(false);
      }
    }

    async function runManualRequest(input: RequestInfo | URL, init?: RequestInit) {
      const response = await fetch(input, init);
      if (!response.ok) return response;

      const result = (await response.clone().json().catch(() => null)) as {
        success?: boolean;
        completed?: boolean;
      } | null;
      if (result?.success === false || result?.completed === false) return response;

      const requestUrl = typeof input === "string" ? input : input.toString();
      const url = new URL(requestUrl, window.location.origin);
      const taskByPath: Record<string, string> = {
        "/api/update-reserve": "reserve",
        "/api/update-new": "new",
        "/api/update-semi-new": "semi-new",
        "/api/update-old": "old",
        "/api/update-sale": "sale",
        "/api/update-ended-sale": "ended-sale",
        "/api/sync/update-stage": "stage",
        "/api/review-update": "review",
        "/api/dmm-ranking": "ranking",
        "/api/score-update": "score",
        "/api/update-missing-prices": "missing-prices",
        "/api/admin/fill-sample-movie": "sample-movie",
      };

      const task = taskByPath[url.pathname];
      if (task) {
        await revalidateAfterManualUpdate([task]);
      } else if (url.pathname === "/api/update-all" && url.searchParams.get("step") === "score") {
        await revalidateAfterManualUpdate([
          "reserve",
          "new",
          "semi-new",
          "old",
          "sale",
          "ended-sale",
          "stage",
          "review",
          "ranking",
          "score",
        ]);
      }

      return response;
    }

    const isUpdating = runningAll || jobs.some(
    (job) =>
      job.status === "running" &&
      job.job_name === "all"
  );

    async function runUpdateUntilCompleted(
      url: string,
      label: string,
    ): Promise<UpdateResponse> {
      const MAX_REQUESTS = 2_000;

      for (let attempt = 0; attempt < MAX_REQUESTS; attempt++) {
        const res = await runManualRequest(url, {
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

        // Give the database connection pool a short recovery window between
        // long-running chunks instead of immediately starting the next browser batch.
        await new Promise((resolve) => setTimeout(resolve, 1_000));
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

  async function runManualUpdate(
    url: string,
    errorMessage: string,
    options: {
      requireSuccess?: boolean;
      successFallback?: string;
      showThrownError?: boolean;
    } = {},
  ) {
    try {
      const response = await runManualRequest(url, { method: "POST" });
      const data = (await response.json()) as UpdateResponse;

      if (options.requireSuccess && (!response.ok || data.success === false)) {
        throw new Error(data.message ?? errorMessage);
      }

      alert(data.message ?? options.successFallback);
      await loadJobs();
    } catch (error) {
      console.error(error);
      alert(
        options.showThrownError && error instanceof Error
          ? error.message
          : errorMessage,
      );
    } finally {
      setLoading(false);
    }
  }

  const handleUpdateNew = () =>
    runManualUpdate("/api/update-new", "新作更新に失敗しました");
  const handleUpdateSemiNew = () =>
    runManualUpdate("/api/update-semi-new", "準新作更新に失敗しました");
  const handleUpdateSale = () =>
    runManualUpdate("/api/update-sale", "セール更新に失敗しました");
  const handleUpdateRanking = () =>
    runManualUpdate("/api/dmm-ranking", "ランキング更新に失敗しました", {
      requireSuccess: true,
      successFallback: "ランキング更新が完了しました",
      showThrownError: true,
    });
  const handleUpdateOld = () =>
    runManualUpdate("/api/update-old", "旧作更新に失敗しました");
  const handleUpdateEndedSale = () =>
    runManualUpdate("/api/update-ended-sale", "終了セール更新に失敗しました");
  const handleUpdateScore = () =>
    runManualUpdate("/api/score-update", "スコア更新に失敗しました", {
      requireSuccess: true,
      successFallback: "スコア更新が完了しました",
      showThrownError: true,
    });

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

  const handleUpdateMissingPrices = () =>
    runManualUpdate("/api/update-missing-prices", "価格補完に失敗しました");

  async function handleFillSampleMovies() {
    try {
      const data = await runUpdateUntilCompleted(
        "/api/admin/fill-sample-movie",
        "サンプル動画補完",
      );

      alert(data.message ?? "サンプル動画補完が完了しました");
      await loadJobs();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "サンプル動画補完に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateActressProfiles() {
    try {
      let offset = 1;
      let processed = 0;
      let total = 0;
      while (true) {
        const response = await fetch(`/api/actress-profile-update?offset=${offset}`, { method: "POST" });
        const data = (await response.json()) as UpdateResponse;
        if (!response.ok || data.success === false) throw new Error(data.message ?? "女優プロフィール補完に失敗しました。");
        processed += data.processedCount ?? 0;
        total = data.totalCount ?? total;
        if (data.completed !== false || !data.nextOffset) break;
        offset = data.nextOffset;
      }
      alert(`女優プロフィール補完が完了しました。${processed}件を確認しました（全${total}件）。`);
      await loadJobs();
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "女優プロフィール補完に失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  async function handleRunSchedule(
    schedule: "daily-0030" | "daily-1030" | "tue-fri-1800" | "sunday-1800",
  ) {
      const schedules = {
        "daily-0030": {
          label: "0:30更新",
          tasks: [
            ["/api/update-reserve", "予約作品更新"],
            ["/api/update-new", "新作更新"],
            ["/api/update-old", "旧作更新"],
            ["/api/update-sale", "セール更新"],
            ["/api/update-ended-sale", "終了セール更新"],
            ["/api/dmm-ranking", "ランキング更新"],
            ["/api/score-update", "スコア更新"],
          ],
        },
        "daily-1030": {
          label: "10:30更新",
          tasks: [
            ["/api/update-sale", "セール更新"],
            ["/api/update-ended-sale", "終了セール更新"],
            ["/api/dmm-ranking", "ランキング更新"],
            ["/api/score-update", "スコア更新"],
          ],
        },
        "tue-fri-1800": {
          label: "火〜金18:00更新",
          tasks: [["/api/update-semi-new", "準新作更新"], ["/api/review-update", "レビュー更新"]],
        },
        "sunday-1800": {
          label: "日曜18:00更新",
          tasks: [["/api/update-missing-prices", "価格補完"]],
        },
      } as const;
      const selected = schedules[schedule];
      setRunningAll(true);
      try {
        for (const [url, label] of selected.tasks) {
          await runUpdateUntilCompleted(url, label);
        }
        alert(`${selected.label}が完了しました。`);
        await loadJobs();
      } catch (error) {
        console.error(error);
        alert(error instanceof Error ? `${selected.label}を中断しました。\n${error.message}` : `${selected.label}に失敗しました。`);
      } finally {
        setRunningAll(false);
      }
  }

  const handleUpdateReserve = () =>
    runManualUpdate("/api/update-reserve", "予約作品更新に失敗しました");
  const handleUpdateStage = () =>
    runManualUpdate("/api/sync/update-stage", "Stage同期に失敗しました");



  const jobsByName = new Map(jobs.map((job) => [job.job_name, job]));
  const displayedJobs: UpdateJob[] = Object.entries(JOB_REGISTRY).map(
    ([jobName]) =>
      jobsByName.get(jobName) ?? {
        job_name: jobName,
        status: "idle",
        processed_count: 0,
        total_count: 0,
        last_product_id: null,
        started_at: null,
        finished_at: null,
      },
  );

  const idleJobCount = displayedJobs.filter(
    (job) => job.status === "idle" && job.total_count === 0
  ).length;


  return {
    jobs, loading, runningAll, refreshingCache, showIdleJobs, setShowIdleJobs, idleJobCount, displayedJobs,
    handleRunSchedule, handleUpdateStage, handleUpdateNew, handleUpdateSemiNew, handleUpdateOld, handleUpdateEndedSale,
    handleUpdateAll, handleUpdateSale, handleUpdateRanking, handleUpdateScore, handleUpdateReview, handleUpdateMissingPrices,
    handleFillSampleMovies, handleUpdateActressProfiles, handleUpdateReserve, handleRefreshPublicCache, isUpdating, handleStop,
  };
}
