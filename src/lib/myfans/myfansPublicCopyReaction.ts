import type { MyfansQuoteCandidate } from "@/lib/myfansAnalytics";
import { compactSourceText } from "@/lib/myfans/myfansCreativeEvidence";
import type { VisualUnderstanding } from "@/lib/myfansXExecution";

export type PublicCopyReactionReview = {
  naturalUserReaction: number;
  analystCommentaryRisk: number;
  sourceSpecificity: number;
  verdict: "natural_user_reaction" | "analyst_commentary" | "needs_more_source";
  reasons: string[];
};

function tokensFor(text: string, minimumLength: number) {
  return text
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length >= minimumLength);
}

function sourceSpecificityFor(body: string, sourceText: string, cue: string) {
  const compactBody = body.replace(/\s+/g, "");
  const sourceTokens = tokensFor(sourceText, 3);
  const cueTokens = tokensFor(cue, 2);
  const sourceHits = [...sourceTokens, ...cueTokens].filter((token) => compactBody.includes(token.replace(/\s+/g, ""))).length;
  return Math.min(100, sourceHits * 24 + (sourceText && body.includes(sourceText.slice(0, Math.min(10, sourceText.length))) ? 28 : 0) + (cue && body.includes(cue.slice(0, Math.min(8, cue.length))) ? 20 : 0));
}

function hasFirstPersonReaction(body: string) {
  return /(え、|うわ|さすがに|普通に|たぶん|好き|見たい|見たく|気になる|二度見|戻る|開く|ずるい|刺さる|分かる|構える|閉じにくい)/.test(body);
}

function hasDirectSocialGesture(body: string) {
  return /(タイムライン|流れてきたら|読んだ瞬間|見た瞬間|一回|少し先|続き|写真を見る前|動画)/.test(body);
}

function analystCommentaryRiskFor(body: string, firstPersonReaction: boolean) {
  const analystSignals = [
    /導入|訴求|設定が立つ|構成|出し方|置き方|判断|比較|分析|選定|効果|反応が残る理由/,
    /長く説明しない分|見方が変わる|場面が浮かぶ|文脈が出ている|普通の紹介文|説明より先に|引っかかる点/,
    /温度がある|導入の圧|読ませてから見せる|分かる人に寄せた|構造|マーケ/,
  ].reduce((score, pattern) => score + (pattern.test(body) ? 28 : 0), 0);
  const abstractReviewerTone = /(こういう|この投稿|この切り取り|反応|入口|見どころ|方向性|具体さ|クセが伝わる)/.test(body) && !firstPersonReaction ? 18 : 0;
  return Math.min(100, analystSignals + abstractReviewerTone);
}

function naturalUserReactionFor(sourceSpecificity: number, firstPersonReaction: boolean, directSocialGesture: boolean, analystCommentaryRisk: number) {
  return Math.round(Math.max(0, Math.min(100,
    (firstPersonReaction ? 36 : 8) +
    (directSocialGesture ? 22 : 6) +
    Math.min(26, sourceSpecificity * 0.35) +
    (analystCommentaryRisk >= 45 ? -28 : 10),
  )));
}

function reasonsFor(firstPersonReaction: boolean, directSocialGesture: boolean, sourceSpecificity: number, analystCommentaryRisk: number) {
  return [
    firstPersonReaction ? "感想/反応の形になっている" : "感想としての主語が弱い",
    directSocialGesture ? "タイムライン上の行動に近い" : "外側からの説明に寄っています",
    sourceSpecificity >= 35 ? "元投稿固有の語が入っている" : "元投稿固有性が弱い",
    analystCommentaryRisk >= 45 ? "分析者/コピー評論の構文が強い" : "評論構文は低い",
  ];
}

function verdictFor(sourceSpecificity: number, analystCommentaryRisk: number): PublicCopyReactionReview["verdict"] {
  return analystCommentaryRisk >= 45
    ? "analyst_commentary"
    : sourceSpecificity < 20
      ? "needs_more_source"
      : "natural_user_reaction";
}

export function reviewPublicCopyReaction(body: string, quote: MyfansQuoteCandidate | null, understanding: VisualUnderstanding | null): PublicCopyReactionReview {
  const sourceText = compactSourceText(quote?.text_excerpt ?? "", 80);
  const cue = understanding?.attentionMoment || understanding?.humanObservation || understanding?.concreteVisualCue || "";
  const sourceSpecificity = sourceSpecificityFor(body, sourceText, cue);
  const firstPersonReaction = hasFirstPersonReaction(body);
  const directSocialGesture = hasDirectSocialGesture(body);
  const analystCommentaryRisk = analystCommentaryRiskFor(body, firstPersonReaction);

  return {
    naturalUserReaction: naturalUserReactionFor(sourceSpecificity, firstPersonReaction, directSocialGesture, analystCommentaryRisk),
    analystCommentaryRisk,
    sourceSpecificity,
    verdict: verdictFor(sourceSpecificity, analystCommentaryRisk),
    reasons: reasonsFor(firstPersonReaction, directSocialGesture, sourceSpecificity, analystCommentaryRisk),
  };
}
