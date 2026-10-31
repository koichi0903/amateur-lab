import assert from "node:assert/strict";
import test from "node:test";
import type { JobProgressDetail } from "@/lib/jobs/progress";
import {
  getJobProgressProductIds,
  projectAdminJobProgress,
  type JobWithProgress,
} from "./jobProgressProjection.ts";

test("collects unique product IDs from progress data and raw job IDs", () => {
  const jobs: JobWithProgress<{ last_product_id: string | null }>[] = [
    { job: { last_product_id: "work-1" }, progress: null },
    {
      job: { last_product_id: "@progress|scan|2|4|work-2" },
      progress: { phase: "scan", current: 2, total: 4, productId: "work-2" },
    },
    { job: { last_product_id: "work-1" }, progress: null },
    { job: { last_product_id: null }, progress: { phase: "scan" } },
  ];

  assert.deepEqual(getJobProgressProductIds(jobs), ["work-1", "work-2"]);
});

test("projects progress fields, product title, and the visible last product ID", () => {
  const progress: JobProgressDetail = {
    phase: "scan",
    current: 2,
    total: 4,
    productId: "work-2",
  };
  const job = {
    job_name: "weekly",
    status: "running",
    last_product_id: "@progress|scan|2|4|work-2",
  };

  assert.deepEqual(
    projectAdminJobProgress(job, progress, new Map([["work-2", "作品タイトル"]])),
    {
      job_name: "weekly",
      status: "running",
      last_product_id: "work-2",
      progress_phase: "scan",
      phase_processed: 2,
      phase_total: 4,
      last_product_title: "作品タイトル",
    },
  );
});

test("preserves ordinary product IDs and clears an encoded value without a product ID", () => {
  const job = { last_product_id: "work-1" };
  assert.equal(
    projectAdminJobProgress(job, null, new Map([["work-1", "作品1"]])).last_product_title,
    "作品1",
  );

  assert.equal(
    projectAdminJobProgress(
      { last_product_id: "@progress|scan|2|4|" },
      { phase: "scan", current: 2, total: 4 },
      new Map(),
    ).last_product_id,
    null,
  );
});
