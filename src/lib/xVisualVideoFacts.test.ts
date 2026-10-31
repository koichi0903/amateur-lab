import assert from "node:assert/strict";
import { buildVisualVideoFacts, isUsableVisualFact, visualFactBasis } from "./xVisualVideoFacts";

const tagged = buildVisualVideoFacts({
  imageUrl: "https://example.test/jacket.jpg",
  sampleMovieUrl: "https://example.test/sample.mp4",
  manualTags: ["first_seconds_strong", "visual_mismatch", "scene_surprise"],
});

assert.deepEqual(tagged.facts.map(({ kind, value, source }) => `${kind}:${value}:${source}`), [
  "image_focus:unknown:metadata",
  "notable_video_hook:sample_available:metadata",
  "notable_video_hook:first_seconds_attention:manual_tag",
  "notable_video_hook:opening_change:manual_tag",
  "jacket_sample_mismatch:true:manual_tag",
]);
assert.equal(tagged.usableFacts.some((item) => item.value === "first_seconds_attention"), true);
assert.equal(tagged.usableFacts.some((item) => item.kind === "jacket_sample_mismatch"), false);
assert.equal(visualFactBasis(tagged).label, "動画");
assert.equal(isUsableVisualFact({ kind: "opening_strength", value: "strong", confidence: 0.95, source: "manual_tag", safePhrase: "冒頭が強い" }), false);
assert.equal(isUsableVisualFact({ kind: "notable_video_hook", value: "opening_change", confidence: 0.95, source: "sample_video", safePhrase: "入り方が少し予想と違う。" }), true);
assert.equal(isUsableVisualFact({ kind: "notable_video_hook", value: "unsupported_scene", confidence: 0.99, source: "sample_video", safePhrase: "具体的な行為がある。" }), false);

const neutralImage = buildVisualVideoFacts({ imageUrl: "https://pics.dmm.co.jp/digital/video/test/testpl.jpg" });
assert.equal(neutralImage.usableFacts.length, 0);
assert.deepEqual(neutralImage.diagnostics, ["画像候補: Visual Factは必須ではなく、本文はDecision Factsで検証"]);
assert.deepEqual(buildVisualVideoFacts({}).diagnostics, ["画像/動画の確定Factなし。メタデータfallbackを使用"]);
assert.deepEqual(buildVisualVideoFacts({ sampleMovieUrl: "https://example.test/sample.mp4" }).diagnostics, ["Fact候補はあるがTruth Guardを通過したFactなし"]);

const dualMismatch = buildVisualVideoFacts({
  videoEvidence: [{ kind: "jacket_sample_mismatch", value: true, confidence: 0.95, safePhrase: "動画で色合いが変わる。" }],
  jacketEvidence: [{ kind: "jacket_sample_mismatch", value: true, confidence: 0.95, safePhrase: "画像では色合いが異なる。" }],
});
assert.deepEqual(dualMismatch.usableFacts.map(({ source }) => source), ["sample_video", "jacket"]);

console.log("xVisualVideoFacts tests passed");
