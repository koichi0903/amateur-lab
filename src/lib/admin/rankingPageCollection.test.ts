import assert from "node:assert/strict";
import test from "node:test";
import { collectUniqueRankingTargets } from "./rankingPageCollection";

test("ranking pages retain the first copy of each item and assign contiguous ranks", async () => {
  const offsets: number[] = [];
  const progress: Array<[number, number, number]> = [];
  const pages: Record<number, Array<{ content_id: string; title: string }>> = {
    1: [{ content_id: "A", title: "first A" }, { content_id: "B", title: "B" }],
    3: [{ content_id: "B", title: "duplicate B" }, { content_id: "C", title: "C" }],
    5: [{ content_id: "D", title: "D" }],
  };

  const result = await collectUniqueRankingTargets({
    limit: 4,
    pageSize: 2,
    maxPageCount: 5,
    fetchPage: async (offset) => {
      offsets.push(offset);
      return pages[offset] ?? [];
    },
    onProgress: async (...entry) => { progress.push(entry); },
  });

  assert.deepEqual(offsets, [1, 3, 5]);
  assert.equal(result.pages, 3);
  assert.deepEqual(result.targets, [
    { content_id: "A", title: "first A", rank: 1 },
    { content_id: "B", title: "B", rank: 2 },
    { content_id: "C", title: "C", rank: 3 },
    { content_id: "D", title: "D", rank: 4 },
  ]);
  assert.deepEqual(progress, [[5, 2, 4], [8, 3, 4], [10, 4, 4]]);
});

test("ranking collection stops at the page cap and reports incomplete unique results", async () => {
  const offsets: number[] = [];
  const result = await collectUniqueRankingTargets({
    limit: 3,
    pageSize: 2,
    maxPageCount: 1,
    fetchPage: async (offset) => {
      offsets.push(offset);
      return [{ content_id: "A" }, { content_id: "B" }];
    },
    onProgress: async () => {},
  });

  assert.deepEqual(offsets, [1]);
  assert.equal(result.pages, 1);
  assert.deepEqual(result.targets.map((item) => item.content_id), ["A", "B"]);
});
