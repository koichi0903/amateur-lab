import assert from "node:assert/strict";
import { buildXGrowthVariantDiagnostic, summarizeXGrowthVariantDiagnostics } from "./xGrowthOS";

const item = {
  workId: 123,
  sampleMovieUrl: "https://cc3001.dmm.co.jp/litevideo/freepv/test/test_dmb_w.mp4",
  recommendedMediaUrl: "https://cc3001.dmm.co.jp/litevideo/freepv/test/test_dmb_w.mp4",
  mediaType: "sample_movie",
  visualScoring: { videoHookStrength: 90, visualSpecificity: 80 },
  canNativeVideo: true,
  mediaAsset: {
    id: 456,
    source_url: "https://cc3001.dmm.co.jp/litevideo/freepv/test/test_dmb_w.mp4",
    source_kind: "official_sample",
    fetch_status: "ok",
    media_quality: "strong",
    manual_tags: ["first_seconds_strong"],
  },
  visualFacts: { facts: [{ kind: "opening_change" }], usableFacts: [] },
} as never;

const videoVariant = {
  id: "video-reach",
  intent: "REACH",
  mediaType: "sample_movie",
  bodyText: "冒頭の入り方が少し予想と違う。\nサンプルで見ると印象が変わる。",
  quality: {
    passed: false,
    recommendation: "revise",
    total: 64,
    dimensions: { adSmell: 10 },
    gate: { failed: ["specificity"] },
    lastMile: {
      passed: false,
      verdict: "revise",
      reasons: ["読者の行動/感情に翻訳されていない"],
      humanVoice: {
        passed: false,
        checks: {
          xNative: true,
          audienceClear: true,
          readerAction: false,
          noInternalMetric: true,
          noRepeatedFact: true,
          concreteOpening: true,
          concreteVisualFact: false,
        },
        forbiddenHits: [],
        reasons: ["読者の行動/感情に翻訳されていない", "観測されたVisual/Video Factが本文に残っていない"],
      },
      nativeXVoice: {
        passed: true,
        checks: { timelineNative: true, notOperatorVoice: true, notReviewSite: true, emotionalFirstLine: true, notTooPolished: true, noTemplateReuse: true, subjectVariety: true },
        forbiddenHits: [],
        reasons: [],
      },
    },
  },
} as never;

const selectedPick = { workId: 123, creativeVariantId: "video-reach", slotId: "slot_1", whyBuzz: "selected" } as never;
const before = JSON.stringify({ item, videoVariant, selectedPick });
const diagnostic = buildXGrowthVariantDiagnostic(item, videoVariant, [selectedPick]);
assert.equal(diagnostic.selected, true);
assert.equal(diagnostic.slot, "slot_1");
assert.equal(diagnostic.videoEligibility?.eligible, true);
assert.equal(diagnostic.humanVoice.checks.readerAction, false);
assert.equal(diagnostic.humanVoice.checks.concreteVisualFact, false);
assert.equal(diagnostic.factTypes[0], "opening_change");
assert.equal(JSON.stringify({ item, videoVariant, selectedPick }), before);

const summary = summarizeXGrowthVariantDiagnostics([diagnostic]);
assert.equal(summary.totalVariants, 1);
assert.equal(summary.humanVoiceNgByCheck.readerAction, 1);
assert.equal(summary.humanVoiceNgByCheck.concreteVisualFact, 1);
assert.equal(summary.selectedByMediaType.sample_movie, 1);

console.log("xGrowth diagnostics tests passed");
