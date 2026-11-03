import assert from "node:assert/strict";
import test from "node:test";
import type { CandidateWork } from "./xPostPlannerData";
import type { XPostLog } from "../xPostLogs";
import { selectWithDiversity } from "./xPostPlannerSelection";

const DAY_MS = 86_400_000;
const NOW = Date.parse("2026-10-30T12:00:00.000Z");

function work(id: number, maker: string, actress: string, score = 100 - id): CandidateWork {
  return { id, maker, actress, score } as CandidateWork;
}

function postLog(workId: number, daysAgo: number): XPostLog {
  return { work_id: workId, posted_at: new Date(NOW - daysAgo * DAY_MS).toISOString() } as XPostLog;
}

const fixedNow = () => NOW;

test("cooldown selects the shortest eligible window that can fill the requested limit", () => {
  const works = [work(1, "M1", "A1"), work(2, "M2", "A2"), work(3, "M3", "A3")];
  const logs = [postLog(1, 10), postLog(2, 8), postLog(3, 6)];

  const result = selectWithDiversity(works, logs, 2, "fixed-seed", DAY_MS, fixedNow);

  assert.equal(result.cooldownDays, 7);
  assert.deepEqual(new Set(result.selected.map((item) => item.id)), new Set([1, 2]));
});

test("selection prefers distinct makers and actresses, then fills remaining slots", () => {
  const works = [
    work(1, "共有メーカー", "共有女優,別名"),
    work(2, "共有メーカー", "共有女優/別表記"),
    work(3, "別メーカー", "別女優"),
  ];
  const firstPass = selectWithDiversity(works, [], 2, "fixed-seed", DAY_MS, fixedNow);
  const duplicateCreatorIds = firstPass.selected.filter((item) => item.id === 1 || item.id === 2);

  assert.equal(firstPass.cooldownDays, 14);
  assert.equal(firstPass.selected.length, 2);
  assert.equal(firstPass.selected.some((item) => item.id === 3), true);
  assert.equal(duplicateCreatorIds.length, 1);

  const sameCreatorWorks = [
    work(4, "同じメーカー", "同じ女優"),
    work(5, "同じメーカー", "同じ女優"),
    work(6, "同じメーカー", "同じ女優"),
  ];
  const filled = selectWithDiversity(sameCreatorWorks, [], 3, "fixed-seed", DAY_MS, fixedNow);
  assert.deepEqual(new Set(filled.selected.map((item) => item.id)), new Set([4, 5, 6]));
});
