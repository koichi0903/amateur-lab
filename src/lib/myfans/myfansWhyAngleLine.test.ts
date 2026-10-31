import assert from "node:assert/strict";
import test from "node:test";
import type { HumanReactionType, PublicCopyFacts, VisualUnderstanding } from "../myfansXExecution";
import { whyAngleLine } from "./myfansPublicCopyGeneration";

function facts(views: number | null = 0): PublicCopyFacts {
  return {
    sourceText: "",
    creatorName: "作者A",
    creatorHandle: "@creator",
    publicMetrics: {
      views,
      likes: null,
      reposts: null,
      replies: null,
      popularityRank: null,
      productLikes: 0,
      productSaves: 0,
      price: 0,
      isNew: false,
    },
    visualContext: "video",
    quoteVisualAnalysis: null,
    productFacts: { title: "作品A", genre: "" },
  };
}

function understanding(overrides: Partial<VisualUnderstanding> = {}): VisualUnderstanding {
  return {
    mediaType: "video",
    concreteVisualCue: "冒頭から距離が変わる",
    attentionMoment: "",
    humanObservation: "",
    visibleChangeOrContrast: "中盤で印象が変わる",
    motionCue: "途中で動きが変わる",
    ...overrides,
  } as unknown as VisualUnderstanding;
}

test("concrete-cue reaction lines preserve their established wording", () => {
  const visual = understanding();
  const expected: Array<[HumanReactionType, string]> = [
    ["curiosity", "ここからどうなるのか気になってしまう。"],
    ["agreement", "冒頭から距離が変わるで一気に持っていく。"],
    ["contrast", "中盤で印象が変わる"],
    ["specific_appeal", "合う人には早い段階で刺さる。"],
    ["visual_clarity", "説明より先に好みが分かる。"],
    ["immediacy", "冒頭にこれを置かれると強い。"],
  ];

  for (const [reaction, line] of expected) assert.equal(whyAngleLine(reaction, visual, facts(), 1), line);
});

test("cue fallback, media-specific copy, and social proof keep their existing precedence", () => {
  const noCue = understanding({ concreteVisualCue: "", attentionMoment: "", humanObservation: "" });
  assert.equal(whyAngleLine("curiosity", noCue, facts(), 1), "冒頭だけで一回開いてしまう。");
  assert.equal(whyAngleLine("contrast", noCue, facts(), 1), "途中で動きが変わる");
  assert.equal(whyAngleLine("surprise", noCue, facts(), 1), "こういう分かりやすい引きは強い。");
  assert.equal(whyAngleLine("surprise", noCue, facts(100_000), 0), "そりゃ10万表示いくよな、ってなる。");
  assert.equal(whyAngleLine("unexpected", understanding(), facts(100_000), 0), "そりゃ10万表示いくよな、ってなる。");
  assert.equal(whyAngleLine("immediacy", understanding({ mediaType: "image" }), facts(), 0), "1枚目でこれを置かれると強い。");
});
