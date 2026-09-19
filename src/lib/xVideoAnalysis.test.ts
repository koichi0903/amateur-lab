import assert from "node:assert/strict";
import test from "node:test";
import { detectBlackIntroEnd } from "./xVideoOpening.ts";

function samples(values: number[]) { return values.map((brightness, index) => ({ timeSec: index * 0.25, brightness })); }

test("完全黒2秒の後に明るくなった位置を検出する", () => {
  assert.equal(detectBlackIntroEnd(samples([...Array(8).fill(0.03), ...Array(5).fill(0.35)]), 12), 2);
});

test("黒からのフェードインは明るさが安定した位置を採用する", () => {
  assert.equal(detectBlackIntroEnd(samples([0.02, 0.03, 0.04, 0.08, 0.13, 0.18, 0.22, 0.24, 0.25]), 12), 1.3);
});

test("最初から明るい動画はトリムしない", () => {
  assert.equal(detectBlackIntroEnd(samples([0.3, 0.3, 0.28, 0.32, 0.3]), 12), 0);
});

test("暗い本編シーンだけではトリムしない", () => {
  assert.equal(detectBlackIntroEnd(samples([0.2, 0.19, 0.08, 0.09, 0.1, 0.11, 0.12, 0.1]), 12), 0);
});
