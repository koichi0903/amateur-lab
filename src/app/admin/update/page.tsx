"use client";

import { useEffect, useState } from "react";

import { supabase } from "../../../lib/supabase";

import UpdateHeader from "./components/UpdateHeader";
import JobCard from "./components/JobCard";
import UpdateButtons from "./components/UpdateButtons";

type Job = {
  job_name: string;
  status: "completed" | "running" | "failed";
  processed_count: number;
  total_count: number;
};

export default function UpdatePage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  async function handleUpdateAll() {
  try {
    const res = await fetch("/api/update-all", {
      method: "POST",
    });

    const data = await res.json();

    alert(data.message);

    await loadJobs();
  } catch (error) {
    console.error(error);
    alert("全更新に失敗しました");
  }
}

async function handleUpdateNew() {
  alert("新作更新ボタンが押されました");
}

async function handleUpdateSemiNew() {
  alert("準新作更新ボタンが押されました");
}

async function handleUpdateSale() {
  alert("セール更新ボタンが押されました");
}

  async function loadJobs() {
    const { data, error } = await supabase
      .from("jobs")
      .select(
        "job_name, status, processed_count, total_count"
      )
      .order("job_name");

    if (error) {
      console.error(error);
      return;
    }
    console.log(data);

    setJobs(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
  void loadJobs();

  const interval = setInterval(() => {
    void loadJobs();
  }, 5000);

  return () => clearInterval(interval);
}, []);

  function getTitle(jobName: string) {
    switch (jobName) {
      case "new":
        return "🆕 新作更新";

      case "semi_new":
        return "⭐ 準新作更新";

      case "sale":
        return "💰 セール更新";

      case "sale_scan":
  return "🔍 セールスキャン";

      default:
        return jobName;
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950">
      <div className="mx-auto max-w-7xl p-10">

        <UpdateHeader />

        {loading ? (
          <div className="py-20 text-center text-zinc-400">
            読み込み中...
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
  {jobs
    .sort((a, b) => {
      const order = {
        new: 1,
        semi_new: 2,
        sale: 3,
        sale_scan: 4,
      };

      return (
        (order[a.job_name as keyof typeof order] ?? 999) -
        (order[b.job_name as keyof typeof order] ?? 999)
      );
    })
    .map((job) => (
      <JobCard
        key={job.job_name}
        title={getTitle(job.job_name)}
        status={job.status}
        processed={job.processed_count}
        total={job.total_count}
      />
    ))}
</div>
        )}

        <div className="mt-10">
          <UpdateButtons
  onUpdateAll={handleUpdateAll}
  onUpdateNew={handleUpdateNew}
  onUpdateSemiNew={handleUpdateSemiNew}
  onUpdateSale={handleUpdateSale}
/>
        </div>

      </div>
    </main>
  );
}