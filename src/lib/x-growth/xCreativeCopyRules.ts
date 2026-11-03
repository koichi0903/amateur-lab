import { primaryUsableVisualFact } from "@/lib/xVisualVideoFacts";
import type { XCopyGrammarValidation, XCreativeInput } from "./xCreativeTypes";
export const PROMO_WORDS = ["期間限定", "今すぐ", "詳細はこちら", "お得", "🔥", "絶対", "見逃し厳禁", "セール中", "激安"];

export const FORBIDDEN_PUBLIC_WORDS = [
  "本文では", "カードで", "見る順番を置く",
  "入口が作れる", "観察ポイント", "確認する価値", "今日買う理由が残る", "安全です", "価格条件は強め",
  "この条件なら", "根拠がそろっている", "広告っぽい", "広告っぽく見えない", "確認する価値があります",
  "今見る理由があります", "順位、評価、価格の根拠がそろっています", "データ上", "データ上では", "スコア",
  "スコア的に", "数字の組み合わせ",
  "数字の組み合わせです", "価格異常", "Opportunity", "Freshness", "発掘指数", "買い時スコア", "価格条件は強め",
  "投稿する価値", "確認する位置", "データ補足", "候補化", "候補です", "候補では", "比較候補",
  "覚えておく方が役に立つ", "拾うなら", "中身として拾いたい", "拾いたい", "入口", "観察",
  "比較メモ", "自然です", "差は大きく見せず", "価格条件", "中身として拾いたい",
  "過去価格との差で止まる日", "本文で説明するより", "動画あり",
  "短く見て決められます", "まず見る場所", "どこを見るか", "刺さるなら", "見ていいと思います",
  "タイトルだけなら流してました", "サンプルまで見ると印象が変わる", "サンプルまで見ると印象が変わりそう",
  "最初に見る場所", "まずだけ", "今日見る場所",
  "本文では", "カードで", "候補", "確認する価値", "刺さる題材だけ見れば十分", "外しにくい",
  "画像で雰囲気は伝わるので", "本文は短くてよさそう", "カードは補助", "気になる一本だけ見れば足ります",
  "半額だけでなく評価も高いので", "気になっていたなら今日は",
];

export const FORBIDDEN_TEMPORAL_WORDS = ["上がってきた", "急上昇", "昨日より", "伸びている", "伸びてきた", "見つかり始めた", "勢いがある", "動きが出ています"];






























export function concreteVisualPhrases(fact: NonNullable<ReturnType<typeof primaryUsableVisualFact>>) {
  if (fact.kind === "jacket_sample_mismatch" || /ジャケとサンプルで印象/.test(fact.safePhrase ?? "")) {
    return ["ジャケとサンプルで見え方が違う。", "表紙の印象とサンプルの雰囲気が少し違う。", "ジャケを見た印象と、動画の入り方に差がある。"];
  }
  if (/入り方が少し予想と違う/.test(fact.safePhrase ?? "") || fact.value === "opening_change") {
    return ["冒頭の展開が予想と少し違う。", "再生してすぐ、想像していた流れと変わった。", "冒頭の入り方が、思っていた流れと少し違う。"];
  }
  if (fact.value === "first_seconds_attention") {
    return ["開いてすぐ、画面の変化に目が止まる。", "最初の数秒で、画面の動きが気になった。", "再生直後の動きに、思わず目が止まる。"];
  }
  if (fact.value === "safe_preview") {
    return ["サンプルの冒頭だけで、見え方が分かる。", "冒頭を少し見ただけでも、作品の雰囲気が伝わる。", "短いサンプルでも、入り方は確かめられる。"];
  }
  return [fact.safePhrase ?? ""].filter(Boolean);
}
export function containsConcreteVisualPhrase(text: string, fact: NonNullable<ReturnType<typeof primaryUsableVisualFact>>) {
  return concreteVisualPhrases(fact).some((phrase) => phrase && text.includes(phrase.replace(/[。．]+$/, "")));
}


/** Reject copy whose grammar implies facts or comparisons the source does not support. */
export function validateXCopyGrammar(input: Pick<XCreativeInput, "sourceType">, text: string): XCopyGrammarValidation {
  const reasons: string[] = [];
  if (/AI生成作品\s*の一本|作品\s+の一本|ジャンル\s*の一本/.test(text)) reasons.push("機械的なカテゴリ主語");
  if (/迷う人は|同じ\d+%?OFFでも|似た条件でも|安さで並べても/.test(text) && input.sourceType !== "COMPARISON") {
    reasons.push("比較対象が確定していない比較文");
  }
  if (/雰囲気だけ|空気だけ|入り方が少し予想と違う/.test(text)) reasons.push("抽象Factだけの表現");
  return { passed: reasons.length === 0, reasons };
}


export function sanitizePublicText(text: string) {
  return FORBIDDEN_PUBLIC_WORDS.reduce((current, word) => current.replaceAll(word, ""), text)
    .replaceAll("こういうを", "これを")
    .replace(/[.…]{2,}/g, "")
    .replace(/\s+寄り/g, "寄り")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}