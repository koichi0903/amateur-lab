import assert from "node:assert/strict";
import test from "node:test";
import type { MyfansLinkStrategy, PublicCopyFacts, QuoteVisualAnalysis } from "./myfansXExecution.ts";
import { buildPublicCopyV10 } from "./myfansPublicCopyGeneration.ts";

const verifiedAnalysis: QuoteVisualAnalysis = {
  status: "verified",
  mediaType: "video",
  frameOrImageCount: 1,
  sceneSummary: "",
  subjectSummary: "",
  composition: "",
  facialExpressionOrPoseCue: "",
  cameraDistanceOrFraming: "",
  visibleChangeOrContrast: "",
  textOverlayCue: "",
  motionCue: "",
  beginningVsLaterChange: "",
  standoutMoment: "",
  concreteObservation: "ベッド越しの距離が近い",
  confidence: "high",
  evidenceSource: "confirmed visual analysis",
  analyzerVersion: "test",
};

function facts(): PublicCopyFacts {
  return {
    sourceText: "",
    creatorName: "作者A",
    creatorHandle: "@creator",
    publicMetrics: {
      views: 0,
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
    quoteVisualAnalysis: verifiedAnalysis,
    productFacts: { title: "作品A", genre: "" },
  };
}

test("V10 keeps verified visual variants and revenue disclosures", () => {
  const input = facts();
  assert.deepEqual(buildPublicCopyV10(input, "discovery", "no_link" satisfies MyfansLinkStrategy, 0), [
    "ベッド越しの距離が近いと、それだけで場面が伝わる。",
    "盛って言わなくても、好きな人にはそこで刺さる。",
  ]);
  assert.deepEqual(buildPublicCopyV10(input, "reply_link_sales", "reply_link" satisfies MyfansLinkStrategy, 1), [
    "白いベッドより、向かい合ってる近さのほうが先に来る。",
    "気になる人だけ自己リプへ。",
  ]);
  assert.deepEqual(buildPublicCopyV10(input, "body_link_sales", "body_link" satisfies MyfansLinkStrategy, 0), [
    "ベッド越しの距離が近いと、それだけで場面が伝わる。 #PR",
    "気になる人だけ詳細へ。",
  ]);
});
