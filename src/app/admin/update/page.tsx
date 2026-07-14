"use client";

import { useEffect, useState } from "react";

import { supabase } from "../../../lib/supabase";

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

export default function UpdatePage() {
  const [jobs, setJobs] = useState<Job[]>([]);
const [loading, setLoading] = useState(true);

const [startedAt] = useState(Date.now());
  
  
  const isUpdating = jobs.some(
  (job) =>
    job.status === "running" &&
    job.job_name === "all"
);

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

async function handleSyncWorks() {
  setLoading(true);

  try {
    const res = await fetch("/api/sync", {
      method: "POST",
    });

    const data = await res.json();

    alert(data.message);

    await loadJobs();
  } catch (e) {
    console.error(e);
    alert("作品同期に失敗しました");
  } finally {
    setLoading(false);
  }
}

async function handleUpdateNew() {
  setLoading(true);
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
  setLoading(true);

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
  setLoading(true);

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

async function handleUpdateOld() {
  setLoading(true);

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
  setLoading(true);

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
  setLoading(true);

  try {
    const res = await fetch("/api/score-update", {
      method: "POST",
    });

    const data = await res.json();

    alert(data.message);

    await loadJobs();
  } catch (e) {
    console.error(e);
    alert("スコア更新に失敗しました");
  } finally {
    setLoading(false);
  }
}

async function handleUpdateStage() {
  setLoading(true);

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
    const { data, error } = await supabase
  .from("jobs")
  .select(`
  job_name,
  status,
  processed_count,
  total_count,
  last_product_id
`)
  .order("job_name");

    if (error) {
      console.error(error);
      return;
    }
    if (!data) {
  setJobs([]);
  setLoading(false);
  return;
}

const jobsWithTitle = await Promise.all(
  data.map(async (job) => {
    if (!job.last_product_id) {
      return {
        ...job,
        last_product_title: undefined,
      };
    }

    const { data: work } = await supabase
      .from("works")
      .select("title")
      .eq("product_id", job.last_product_id)
      .maybeSingle();

    return {
      ...job,
      last_product_title: work?.title,
    };
  })
);

setJobs(jobsWithTitle);
setLoading(false);
  }

  useEffect(() => {
  void loadJobs();

  const interval = setInterval(() => {
    void loadJobs();
  }, 5000);

  return () => clearInterval(interval);
}, []);

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
  .filter((job) => job.job_name !== "sale_scan")
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
  onSyncWorks={handleSyncWorks}
  onUpdateStage={handleUpdateStage}

  onUpdateNew={handleUpdateNew}
  onUpdateSemiNew={handleUpdateSemiNew}
  onUpdateOld={handleUpdateOld}

  onUpdateSale={handleUpdateSale}
  onUpdateEndedSale={handleUpdateEndedSale}

  onUpdateAll={handleUpdateAll}

  isUpdating={isUpdating}
/>
</div>

      </div>
    </main>
  );
}