import assert from "node:assert/strict";
import test from "node:test";
import type { XGrowthOpportunity } from "./xGrowthTypes";
import { buildMediaSupplyStageDiagnostics } from "./xGrowthSupplyDiagnostics";

const officialMovieUrl = "https://cc3001.dmm.co.jp/litevideo/freepv/fixture/fixture_dmb_w.mp4";

function creativeVariant(
  mediaType: "sample_movie" | "existing_link_image",
  options: { intent?: string; qualityPassed?: boolean; nativeVoicePassed?: boolean; adSmell?: number } = {},
) {
  const qualityPassed = options.qualityPassed ?? true;
  return {
    mediaType,
    intent: options.intent ?? "REACH",
    quality: {
      passed: qualityPassed,
      recommendation: qualityPassed ? "pass" : "reject",
      dimensions: { adSmell: options.adSmell ?? 0 },
      lastMile: {
        passed: true,
        humanVoice: { passed: true },
        nativeXVoice: { passed: options.nativeVoicePassed ?? true },
      },
    },
  };
}

function opportunity(
  workId: number,
  options: {
    mediaType: "sample_movie" | "existing_link_image";
    imageUrl?: string | null;
    visualHookStrength?: number;
    creativeVariants?: unknown[];
  },
): XGrowthOpportunity {
  const isVideo = options.mediaType === "sample_movie";
  return {
    workId,
    mediaType: options.mediaType,
    imageUrl: options.imageUrl === undefined ? (isVideo ? null : `https://example.test/${workId}.jpg`) : options.imageUrl,
    sampleMovieUrl: isVideo ? officialMovieUrl : null,
    recommendedMediaUrl: null,
    canNativeVideo: isVideo,
    mediaAsset: isVideo ? {
      source_url: officialMovieUrl,
      source_kind: "official_sample",
      fetch_status: "ok",
      fetch_status_code: 200,
      mime_type: "video/mp4",
      content_length: 4096,
    } : null,
    visualScoring: { videoHookStrength: options.visualHookStrength ?? 0, visualSpecificity: 0 },
    visualFacts: { usableFacts: [] },
    decisionFacts: null,
    creativeVariants: options.creativeVariants ?? [],
  } as unknown as XGrowthOpportunity;
}

test("image supply diagnostics preserve per-work stage and exclusion counts", () => {
  const items = [
    opportunity(1, { mediaType: "existing_link_image", creativeVariants: [creativeVariant("existing_link_image")] }),
    opportunity(2, { mediaType: "existing_link_image", creativeVariants: [creativeVariant("existing_link_image")] }),
    opportunity(3, {
      mediaType: "existing_link_image",
      creativeVariants: [
        creativeVariant("existing_link_image"),
        creativeVariant("existing_link_image", { intent: "CONVERSATION" }),
        creativeVariant("sample_movie"),
      ],
    }),
    opportunity(4, { mediaType: "existing_link_image" }),
    opportunity(5, { mediaType: "existing_link_image", creativeVariants: [creativeVariant("existing_link_image", { qualityPassed: false })] }),
    opportunity(6, { mediaType: "existing_link_image", imageUrl: null, creativeVariants: [creativeVariant("existing_link_image")] }),
  ];

  assert.deepEqual(
    buildMediaSupplyStageDiagnostics(items, "existing_link_image", new Set([1]), new Set([2])),
    {
      rawWorks: 5,
      postedExcludedWorks: 2,
      afterPostedWorks: 3,
      usableFetchableWorks: 3,
      generatedVariants: 2,
      generatedVariantWorks: 2,
      creativeQualityVariants: 1,
      creativeQualityWorks: 1,
      nativeXVoiceVariants: 1,
      nativeXVoiceWorks: 1,
      videoHookFactWorks: 0,
      technicalGateRejectedWorks: 0,
      finalEligibleWorks: 1,
      firstDropReasonCounts: {
        generated_variants: 1,
        creative_quality_gate: 1,
        posted_or_recently_selected: 2,
      },
    },
  );
});

test("video supply diagnostics preserve hook and ad-smell gates", () => {
  const items = [
    opportunity(20, { mediaType: "sample_movie", visualHookStrength: 100, creativeVariants: [creativeVariant("sample_movie")] }),
    opportunity(21, { mediaType: "sample_movie", creativeVariants: [creativeVariant("sample_movie")] }),
    opportunity(22, { mediaType: "sample_movie", visualHookStrength: 100, creativeVariants: [creativeVariant("sample_movie", { adSmell: 31 })] }),
  ];

  assert.deepEqual(
    buildMediaSupplyStageDiagnostics(items, "sample_movie", new Set(), new Set()),
    {
      rawWorks: 3,
      postedExcludedWorks: 0,
      afterPostedWorks: 3,
      usableFetchableWorks: 3,
      generatedVariants: 3,
      generatedVariantWorks: 3,
      creativeQualityVariants: 3,
      creativeQualityWorks: 3,
      nativeXVoiceVariants: 3,
      nativeXVoiceWorks: 3,
      videoHookFactWorks: 2,
      technicalGateRejectedWorks: 0,
      finalEligibleWorks: 1,
      firstDropReasonCounts: {
        video_hook_fact_gate: 1,
        soft_quality_or_ad_smell_gate: 1,
      },
    },
  );
});

test("video supply diagnostics retain the technical media rejection stage", () => {
  const unusableVideo = {
    workId: 30,
    mediaType: "sample_movie",
    sampleMovieUrl: null,
    recommendedMediaUrl: "https://example.test/unverified.mp4",
    mediaAsset: null,
    creativeVariants: [creativeVariant("sample_movie")],
  } as unknown as XGrowthOpportunity;

  const diagnostics = buildMediaSupplyStageDiagnostics([unusableVideo], "sample_movie", new Set(), new Set());

  assert.equal(diagnostics.rawWorks, 1);
  assert.equal(diagnostics.technicalGateRejectedWorks, 1);
  assert.equal(diagnostics.usableFetchableWorks, 0);
  assert.deepEqual(diagnostics.firstDropReasonCounts, { official_sample_fetchability_or_media_unusable: 1 });
});
