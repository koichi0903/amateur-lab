import assert from "node:assert/strict";
import test from "node:test";
import { detectBlankIntroEnd } from "./xVideoOpening.ts";

test("detects a low-information dark intro", () => {
  const result = detectBlankIntroEnd([
    { timeSec: 0, brightness: 0.01, detail: 0, colorVariance: 0 },
    { timeSec: 0.4, brightness: 0.01, detail: 0, colorVariance: 0 },
    { timeSec: 0.8, brightness: 0.01, detail: 0, colorVariance: 0 },
    { timeSec: 0.9, brightness: 0.35, detail: 0.1, colorVariance: 0.08 },
  ], 5);
  assert.deepEqual(result, { endSec: 0.9, kind: "black" });
});

test("detects a low-information bright intro", () => {
  const result = detectBlankIntroEnd([
    { timeSec: 0, brightness: 0.99, detail: 0, colorVariance: 0 },
    { timeSec: 0.6, brightness: 0.99, detail: 0, colorVariance: 0 },
    { timeSec: 1.2, brightness: 0.99, detail: 0, colorVariance: 0 },
    { timeSec: 1.3, brightness: 0.5, detail: 0.1, colorVariance: 0.08 },
  ], 5);
  assert.deepEqual(result, { endSec: 1.3, kind: "white" });
});

test("detects a bright fade while it remains low-information", () => {
  const result = detectBlankIntroEnd([
    { timeSec: 0, brightness: 0.99, detail: 0, colorVariance: 0 },
    { timeSec: 0.25, brightness: 0.89, detail: 0.008, colorVariance: 0.002 },
    { timeSec: 0.5, brightness: 0.76, detail: 0.019, colorVariance: 0.009 },
    { timeSec: 0.75, brightness: 0.61, detail: 0.04, colorVariance: 0.03 },
  ], 5);
  assert.deepEqual(result, { endSec: 0.8, kind: "white" });
});

test("does not classify detailed dark or bright content as blank", () => {
  const dark = detectBlankIntroEnd([
    { timeSec: 0, brightness: 0.08, detail: 0.12, colorVariance: 0.04 },
    { timeSec: 0.6, brightness: 0.1, detail: 0.1, colorVariance: 0.04 },
  ], 5);
  const bright = detectBlankIntroEnd([
    { timeSec: 0, brightness: 0.92, detail: 0.1, colorVariance: 0.04 },
    { timeSec: 0.6, brightness: 0.94, detail: 0.1, colorVariance: 0.04 },
  ], 5);
  assert.equal(dark.endSec, 0);
  assert.equal(bright.endSec, 0);
});
