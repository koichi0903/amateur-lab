import assert from "node:assert/strict";
import { buildVisualVideoFacts, isUsableVisualFact, visualFactBasis } from "./xVisualVideoFacts";

const tagged = buildVisualVideoFacts({
  imageUrl: "https://example.test/jacket.jpg",
  sampleMovieUrl: "https://example.test/sample.mp4",
  manualTags: ["first_seconds_strong", "visual_mismatch", "scene_surprise"],
});

assert.equal(tagged.usableFacts.some((item) => item.value === "first_seconds_attention"), true);
assert.equal(tagged.usableFacts.some((item) => item.kind === "jacket_sample_mismatch"), false);
assert.equal(visualFactBasis(tagged).label, "動画");
assert.equal(isUsableVisualFact({ kind: "opening_strength", value: "strong", confidence: 0.95, source: "manual_tag", safePhrase: "冒頭が強い" }), false);
assert.equal(isUsableVisualFact({ kind: "notable_video_hook", value: "opening_change", confidence: 0.95, source: "sample_video", safePhrase: "入り方が少し予想と違う。" }), true);
assert.equal(isUsableVisualFact({ kind: "notable_video_hook", value: "unsupported_scene", confidence: 0.99, source: "sample_video", safePhrase: "具体的な行為がある。" }), false);

const neutralImage = buildVisualVideoFacts({ imageUrl: "https://pics.dmm.co.jp/digital/video/test/testpl.jpg" });
assert.equal(neutralImage.usableFacts.length, 0);
assert.deepEqual(neutralImage.diagnostics, ["画像候補: Visual Factは必須ではなく、本文はDecision Factsで検証"]);

console.log("xVisualVideoFacts tests passed");
