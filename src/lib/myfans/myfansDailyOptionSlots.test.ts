import assert from "node:assert/strict";
import test from "node:test";
import type { MyfansDailyOptionGenerationInput, MyfansCandidateForDiversity, RotationItem } from "../myfansXExecution";
import { buildMyfansDailyOptionSlots } from "./myfansDailyOptionSlots";

function rotations(): RotationItem[] {
  return Array.from({ length: 4 }, (_, index) => ({
    postType: "revenue",
    linkStrategy: "reply_link",
    objective: "conversion",
    cta: "作品を確認",
    slot: `slot-${index + 1}`,
    role: "収益候補",
  }));
}

function makeCandidate(values: {
  body: string;
  sourceXUrl: string;
  quoteXUrl: string;
  qualityVerdict: "PASS" | "HOLD";
  qualityTotal: number;
  productId: number | null;
  resolverProductId: string | null;
}): MyfansCandidateForDiversity {
  return {
    body: values.body,
    sourceXUrl: values.sourceXUrl,
    quoteXUrl: values.quoteXUrl,
    quality: { verdict: values.qualityVerdict, total: values.qualityTotal, reasons: [] },
    product: values.productId === null ? null : { id: values.productId },
    resolverEvidence: values.resolverProductId === null ? null : { confidence: "exact", product_id: values.resolverProductId },
    monetizableStatus: values.productId === null ? "unlinked" : "linked",
  } as unknown as MyfansCandidateForDiversity;
}

function generationInput(overrides: Partial<MyfansDailyOptionGenerationInput> = {}): MyfansDailyOptionGenerationInput {
  const input: MyfansDailyOptionGenerationInput = {
    rotation: rotations(),
    slotOptions: [],
    buildCandidate: (item, _index, attempt) => makeCandidate({
      body: `${item.slot} candidate ${attempt}`,
      sourceXUrl: `https://x.com/${item.slot}/status/${attempt}`,
      quoteXUrl: `https://x.com/${item.slot}/status/${attempt}`,
      qualityVerdict: "PASS",
      qualityTotal: 90,
      productId: attempt + 1,
      resolverProductId: String(attempt + 1),
    }),
    evaluateDiversity: (candidate) => candidate as unknown as ReturnType<MyfansDailyOptionGenerationInput["evaluateDiversity"]>,
    noveltyFor: () => ({
      maxPastSimilarity: 0,
      nearestPastPostId: null,
      sameSourcePastCount: 0,
      sameTopicPastCount: 0,
      verdict: "fresh",
      label: "高",
      sameSourceLabel: "なし",
      lastSameSourceDate: null,
      lastSameCreatorDate: null,
      pastBodySimilarityLabel: "低",
    }),
    optionDiverseEnough: () => true,
    quotePool: { global: [] } as unknown as MyfansDailyOptionGenerationInput["quotePool"],
    quoteBySlot: new Map(),
    normalizeSourceUrl: (value) => value ?? "",
    detectPublicCopyLeak: () => ({ hasLeak: false }),
    slotRecoveryMaxAttempts: 2,
    multiAngleAttemptsPerTopic: 1,
    qualityGateMinimum: 80,
  };

  return { ...input, ...overrides };
}

test("daily option slots fill four rotations with three unique ranked options each", () => {
  const rotation = rotations();
  const slots = buildMyfansDailyOptionSlots(generationInput());

  assert.deepEqual(slots.map((slot) => ({
    slot: slot.slot,
    postOrder: slot.postOrder,
    recommendedOption: slot.recommendedOption,
    optionLabels: slot.candidates.map((candidate) => candidate.optionLabel),
    sourceUrls: slot.candidates.map((candidate) => candidate.quoteXUrl),
  })), rotation.map((item, index) => ({
    slot: item.slot,
    postOrder: index + 1,
    recommendedOption: "A",
    optionLabels: ["A", "B", "C"],
    sourceUrls: [0, 2, 4].map((attempt) => `https://x.com/${item.slot}/status/${attempt}`),
  })));

  const allSources = slots.flatMap((slot) => slot.candidates.map((candidate) => candidate.quoteXUrl));
  assert.equal(new Set(allSources).size, 12);
});

test("ranked quote rows backfill an under-filled daily option board", () => {
  const quoteRows = Array.from({ length: 12 }, (_, index) => ({
    candidate: { x_post_url: `https://x.com/source/status/${index + 1}` },
  }));
  const quoteBySlot = new Map();
  const input = generationInput({
    buildCandidate: (item, _index, attempt, _excludedProducts, forcedQuote) => {
      const source = forcedQuote?.x_post_url ?? "";
      return makeCandidate({
        body: forcedQuote ? `${item.slot} ranked quote` : "",
        sourceXUrl: source,
        quoteXUrl: source,
        qualityVerdict: "HOLD",
        qualityTotal: 10,
        productId: null,
        resolverProductId: null,
      });
    },
    quotePool: { global: quoteRows } as unknown as MyfansDailyOptionGenerationInput["quotePool"],
    quoteBySlot,
  });

  const slots = buildMyfansDailyOptionSlots(input);

  assert.equal(slots.length, 4);
  assert.ok(slots.every((slot) => slot.candidates.length === 3));
  assert.equal(quoteBySlot.size, 4);
  assert.ok(slots.flatMap((slot) => slot.candidates).every((candidate) => candidate.quality.verdict === "PASS" && candidate.quality.total >= 80));
  assert.equal(new Set(slots.flatMap((slot) => slot.candidates.map((candidate) => candidate.quoteXUrl))).size, 12);
});
