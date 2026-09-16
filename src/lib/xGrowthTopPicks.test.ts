import assert from "node:assert/strict";
import { buildTopPickSlotsViewModel, normalizeTopPickCandidates } from "./xGrowthTopPicks.ts";

const input = ["slot_1", "slot_2", "slot_3"].flatMap((slotId, slotIndex) => ["A", "B", "C"].map((candidateRank, rankIndex) => ({
  slotId,
  candidateRank,
  candidateId: `${slotId}-${candidateRank}`,
  workId: slotIndex * 10 + rankIndex + 1,
  isSelected: candidateRank === "A",
})));

const normalized = normalizeTopPickCandidates(input);
const slots = buildTopPickSlotsViewModel(normalized);
assert.deepEqual(slots.map((slot) => slot.candidates.length), [3, 3, 3]);
assert.equal(normalized.find((candidate) => candidate.candidateId === "slot_1-B")?.isSelected, false);

const selectedB = normalized.map((candidate) => candidate.slotId === "slot_1" ? { ...candidate, isSelected: candidate.candidateId === "slot_1-B" } : candidate);
assert.deepEqual(buildTopPickSlotsViewModel(selectedB).map((slot) => slot.candidates.length), [3, 3, 3]);

const posted = normalizeTopPickCandidates([
  { candidateId: "one", workId: 123, candidateRank: "A" },
  { candidateId: "two", workId: "123", candidateRank: "B" },
  { candidateId: "three", workId: 124, candidateRank: "C" },
], new Set([123]));
assert.deepEqual(posted.map((candidate) => candidate.workId), [124]);

const legacy = normalizeTopPickCandidates([
  { work_id: 7, pick_order: 1, selected: true },
  { work_id: 8, pick_order: 1, selected: false },
  { work_id: 9, pick_order: 1, selected: false },
]);
assert.deepEqual(legacy.map((candidate) => [candidate.slotId, candidate.candidateRank]), [["slot_1", "A"], ["slot_1", "B"], ["slot_1", "C"]]);

console.log("xGrowthTopPicks regression tests passed");
