import assert from "node:assert/strict";
import test from "node:test";
import { collectBijyoActiveWorkIds, hydrateBijyoActiveJobs } from "./bijyoActiveJobProjection.ts";

test("collects unique positive safe work ids in first-seen order", () => {
  const rows = [
    { work_id: "12" },
    { work_id: 4 },
    { work_id: 12 },
    { work_id: 0 },
    { work_id: -1 },
    { work_id: "invalid" },
    { work_id: Number.MAX_SAFE_INTEGER + 1 },
  ];

  assert.deepEqual(collectBijyoActiveWorkIds(rows), [12, 4]);
});

test("hydrates jobs with their work, refreshes reply text, and leaves missing work null", () => {
  const jobs = [
    { id: 1, work_id: 12, reply_text: "stale", status: "pending" },
    { id: 2, work_id: 99, reply_text: "stale", status: "skipped" },
  ];
  const works = [{ id: 12, title: "sample work" }];

  assert.deepEqual(hydrateBijyoActiveJobs(jobs, works, (workId) => `reply:${workId}`), [
    { id: 1, work_id: 12, reply_text: "reply:12", status: "pending", work: works[0] },
    { id: 2, work_id: 99, reply_text: "reply:99", status: "skipped", work: null },
  ]);
});
