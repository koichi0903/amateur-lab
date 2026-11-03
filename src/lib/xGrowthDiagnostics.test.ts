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
    fetch_status_code: 200,
    mime_type: "video/mp4",
    content_length: 123456,
    rights_status: "allowed",
    x_usage_allowed: true,
    can_reupload: true,
    quote_only: false,
    commercial_use_allowed: true,
    media_quality: "strong",
    manual_tags: ["first_seconds_strong"],
  },
  visualFacts: { facts: [{ kind: "opening_change" }], usableFacts: [] },
} as never;

const videoVariantData = {
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
};
const videoVariant = videoVariantData as never;

const selectedPickData = { workId: 123, creativeVariantId: "video-reach", slotId: "slot_1", whyBuzz: "selected" };
const selectedPick = selectedPickData as never;
const before = JSON.stringify({ item, videoVariant, selectedPick });
const diagnostic = buildXGrowthVariantDiagnostic(item, videoVariant, [selectedPick]);
assert.equal(diagnostic.selected, true);
assert.equal(diagnostic.slot, "slot_1");
assert.equal(diagnostic.selectedReason, "selected");
assert.equal(diagnostic.videoEligibility?.eligible, true);
assert.equal(diagnostic.humanVoice.checks.readerAction, false);
assert.equal(diagnostic.humanVoice.checks.concreteVisualFact, false);
assert.equal(diagnostic.factTypes[0], "opening_change");
assert.equal(JSON.stringify({ item, videoVariant, selectedPick }), before);

const alternativeReasonDiagnostic = buildXGrowthVariantDiagnostic(item, videoVariant, [
  { ...selectedPickData, alternativeReason: "alternative reason" } as never,
]);
assert.equal(alternativeReasonDiagnostic.selectedReason, "alternative reason");

const sameWorkDiagnostic = buildXGrowthVariantDiagnostic(item, {
  ...videoVariantData,
  id: "other-variant",
} as never, [selectedPick]);
assert.equal(sameWorkDiagnostic.selectedReason, "同一workの別variant/roleを選定");

const qualityRejectionDiagnostic = buildXGrowthVariantDiagnostic(item, videoVariant);
assert.equal(qualityRejectionDiagnostic.selectedReason, "quality gate NG: specificity");

const softVideoVariant = {
  ...videoVariantData,
  quality: {
    ...videoVariantData.quality,
    passed: true,
    dimensions: { adSmell: 50 },
  },
} as never;
const videoRejectionDiagnostic = buildXGrowthVariantDiagnostic(item, softVideoVariant);
assert.equal(videoRejectionDiagnostic.selectedReason, "動画供給候補外: human voice gate NG");

const imageVariant = {
  ...videoVariantData,
  mediaType: "existing_link_image",
  quality: { ...videoVariantData.quality, passed: true },
} as never;
const finalSelectionDiagnostic = buildXGrowthVariantDiagnostic(item, imageVariant);
assert.equal(finalSelectionDiagnostic.selectedReason, "枠・多様性・重複・スコアによる最終選定で非選択（個別reject codeなし）");

const summary = summarizeXGrowthVariantDiagnostics([diagnostic]);
assert.equal(summary.totalVariants, 1);
assert.equal(summary.humanVoiceNgByCheck.readerAction, 1);
assert.equal(summary.humanVoiceNgByCheck.concreteVisualFact, 1);
assert.equal(summary.selectedByMediaType.sample_movie, 1);
assert.deepEqual(summary, {
  totalVariants: 1,
  mediaTypeCounts: { sample_movie: 1 },
  selectedByMediaType: { sample_movie: 1 },
  humanVoiceNgByCheck: { readerAction: 1, concreteVisualFact: 1 },
  nativeXVoiceNgByCheck: {},
  lastMileNgReasons: { "読者の行動/感情に翻訳されていない": 1 },
  qualityNgReasons: { specificity: 1, "読者の行動/感情に翻訳されていない": 1 },
  factTypeCounts: { opening_change: 1 },
  videoRejectionReasons: { "最終動画候補としてselected": 1 },
});

console.log("xGrowth diagnostics tests passed");
