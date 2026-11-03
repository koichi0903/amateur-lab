import assert from "node:assert/strict";
import test from "node:test";
import { myfansOptionMetadata } from "./myfansOptionMetadata";

test("myfansOptionMetadata preserves the ordered A/B/C labels, names, and ranks", () => {
  assert.deepEqual([0, 1, 2].map(myfansOptionMetadata), [
    { optionLabel: "A", optionName: "おすすめ", optionRank: 1 },
    { optionLabel: "B", optionName: "別の切り口", optionRank: 2 },
    { optionLabel: "C", optionName: "攻めた案", optionRank: 3 },
  ]);
});
