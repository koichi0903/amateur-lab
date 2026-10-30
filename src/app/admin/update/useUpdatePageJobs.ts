"use client";

import { useEffect, useState } from "react";

export type UpdateJob = {
  job_name: string;
  status: "completed" | "running" | "failed" | "idle";
  processed_count: number;
  total_count: number;
  last_product_id: string | null;
  last_product_title?: string;
  progress_phase?: string;
  phase_processed?: number;
  phase_total?: number;
  error_message?: string | null;
  started_at: string | null;
  finished_at: string | null;
};

export default function useUpdatePageJobs() {
  const [jobs, setJobs] = useState<UpdateJob[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadJobs(): Promise<UpdateJob[]> {
    try {
      const response = await fetch("/api/admin/jobs", { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load jobs");

      const payload = (await response.json()) as { jobs?: UpdateJob[] };
      const nextJobs = payload.jobs ?? [];
      setJobs(nextJobs);
      return nextJobs;
    } catch (error) {
      console.error(error);
      setJobs([]);
      return [];
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    let polling = false;

    const scheduleNext = (delay: number) => {
      if (cancelled) return;

      timeoutId = setTimeout(() => {
        void pollJobs();
      }, delay);
    };

    const pollJobs = async () => {
      if (cancelled || polling || document.visibilityState !== "visible") return;

      polling = true;
      const latestJobs = await loadJobs();
      polling = false;

      if (cancelled || document.visibilityState !== "visible") return;

      const hasRunningJob = latestJobs.some((job) => job.status === "running");
      scheduleNext(hasRunningJob ? 5_000 : 15_000);
    };

    const handleVisibilityChange = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }

      // Hidden admin tabs do not poll; refresh when the operator returns.
      if (document.visibilityState === "visible") void pollJobs();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    void pollJobs();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return { jobs, loading, setLoading, loadJobs };
}
