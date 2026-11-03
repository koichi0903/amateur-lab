import assert from "node:assert/strict";
import test from "node:test";
import {
  selectMyfansFinalDailyCandidates,
  type MyfansFinalDailyCandidate,
  type MyfansFinalDailySlot,
} from "./myfansDailySelection.ts";

function candidate(
  id: string,
  plannedSlot: string,
  optionLabel: "A" | "B" | "C",
  quality: number,
  author: string,
  monetizableStatus = "unlinked",
): MyfansFinalDailyCandidate {
  return {
    id,
    plannedSlot,
    optionLabel,
    quality: { total: quality },
    monetizableStatus,
    sourceAuthorHandle: author,
  };
}

function slot<TCandidate extends MyfansFinalDailyCandidate>(
  postOrder: number,
  candidates: TCandidate[],
): MyfansFinalDailySlot<TCandidate> {
  return {
    slot: `slot-${postOrder}`,
    postOrder,
    recommendedOption: "A",
    candidates,
  };
}

test("prioritizes the recommended option, then uses a monetizable alternative for later slots", () => {
  const dailyOptions = [
    slot(1, [
      candidate("1a", "slot-1", "A", 90, "author-a"),
      candidate("1b", "slot-1", "B", 70, "author-b", "linked_affiliate_ready"),
    ]),
    slot(2, [candidate("2a", "slot-2", "A", 80, "author-c")]),
    slot(3, [
      candidate("3a", "slot-3", "A", 95, "author-d"),
      candidate("3b", "slot-3", "B", 75, "author-e", "linked_affiliate_ready"),
    ]),
  ];

  const result = selectMyfansFinalDailyCandidates(dailyOptions, 2, 6);

  assert.deepEqual(result.finalCandidates.map((item) => item.id), ["1a", "2a", "3b"]);
  assert.deepEqual(result.selectedOptions, { "1": "A", "2": "A", "3": "B" });
});

test("avoids selecting the same creator twice when another option is available", () => {
  const dailyOptions = [
    slot(1, [candidate("1a", "slot-1", "A", 90, "Creator")]),
    slot(2, [
      candidate("2a", "slot-2", "A", 85, "creator"),
      candidate("2b", "slot-2", "B", 70, "different"),
    ]),
  ];

  const result = selectMyfansFinalDailyCandidates(dailyOptions, 1, 6);

  assert.deepEqual(result.finalCandidates.map((item) => item.id), ["1a", "2b"]);
  assert.deepEqual(result.selectedOptions, { "1": "A", "2": "B" });
});

test("ranks selected candidates by quality and enforces the configured maximum", () => {
  const dailyOptions = [
    slot(1, [candidate("1a", "slot-1", "A", 10, "a")]),
    slot(2, [candidate("2a", "slot-2", "A", 40, "b")]),
    slot(3, [candidate("3a", "slot-3", "A", 30, "c")]),
    slot(4, [candidate("4a", "slot-4", "A", 20, "d")]),
  ];

  const result = selectMyfansFinalDailyCandidates(dailyOptions, 2, 3);

  assert.deepEqual(result.finalCandidates.map((item) => item.id), ["2a", "3a", "4a"]);
  assert.deepEqual(result.selectedOptions, { "2": "A", "3": "A", "4": "A" });
});
