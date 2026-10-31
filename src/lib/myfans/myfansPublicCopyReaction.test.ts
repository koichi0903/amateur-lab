import assert from "node:assert/strict";
import test from "node:test";
import type { MyfansQuoteCandidate } from "../myfansAnalytics";
import type { VisualUnderstanding } from "../myfansXExecution";
import { reviewPublicCopyReaction } from "./myfansPublicCopyReaction";

function quote(text_excerpt: string): MyfansQuoteCandidate {
  return { text_excerpt } as MyfansQuoteCandidate;
}

test("public-copy reaction review preserves source-specific natural-reaction scoring", () => {
  const review = reviewPublicCopyReaction(
    "え、白いカップを持つ仕草好き。流れてきたら一回戻る。",
    quote("白いカップを持つ仕草が印象的"),
    { attentionMoment: "カップを持つ" } as VisualUnderstanding,
  );

  assert.deepEqual(review, {
    naturalUserReaction: 93,
    analystCommentaryRisk: 0,
    sourceSpecificity: 72,
    verdict: "natural_user_reaction",
    reasons: [
      "感想/反応の形になっている",
      "タイムライン上の行動に近い",
      "元投稿固有の語が入っている",
      "評論構文は低い",
    ],
  });
});

test("public-copy reaction review keeps analyst-commentary verdict precedence", () => {
  const review = reviewPublicCopyReaction(
    "この投稿は導入の構成と効果を比較し、文脈が出ている。マーケ視点で説明したい。",
    null,
    null,
  );

  assert.deepEqual(review, {
    naturalUserReaction: 0,
    analystCommentaryRisk: 100,
    sourceSpecificity: 0,
    verdict: "analyst_commentary",
    reasons: [
      "感想としての主語が弱い",
      "外側からの説明に寄っています",
      "元投稿固有性が弱い",
      "分析者/コピー評論の構文が強い",
    ],
  });
});

test("public-copy reaction review asks for source when no specific evidence exists", () => {
  const review = reviewPublicCopyReaction("今日は晴れです。", null, null);

  assert.deepEqual(review, {
    naturalUserReaction: 24,
    analystCommentaryRisk: 0,
    sourceSpecificity: 0,
    verdict: "needs_more_source",
    reasons: [
      "感想としての主語が弱い",
      "外側からの説明に寄っています",
      "元投稿固有性が弱い",
      "評論構文は低い",
    ],
  });
});
