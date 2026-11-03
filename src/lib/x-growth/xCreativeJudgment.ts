import { primaryActress } from "./xCreativeInputFacts";
import type { XCreativeInput } from "./xCreativeTypes";

function judgmentEvidenceLine(input: XCreativeInput) {
  if (input.reviewAverage && input.reviewAverage < 4.2) return "値引きより、評価の低さが先に引っかかります。";
  if (!input.isNinetyDayLow && input.discountRate >= 30) return "値引きはありますが、価格優位だけで押すには少し弱いです。";
  if ((input.xPageViews ?? 0) >= 5 && (input.xFanzaClicks ?? 0) === 0) return "反応はあってもクリックに進んでいないので、今日は売り込まない判断でいいです。";
  return "買う理由より、見送る理由を先に置いた方が信頼を残せます。";
}

function hiddenGemJudgmentLine(input: XCreativeInput) {
  if (input.discountRate >= 30) return "セール目的じゃなくても、一度サンプルまで見てほしい。";
  if (input.reviewAverage && input.reviewAverage >= 4.6) return "ランキングだけなら見落とすけど、評価まで見ると少し残ります。";
  return "表紙より中身を先に見たい。";
}

function actressTrendJudgmentLine(input: XCreativeInput) {
  return primaryActress(input)
    ? "女優目当てなら、タイトルより中身を先に見たい。"
    : "タイトルより中身を先に見たい。";
}

export function judgmentSourceLine(input: XCreativeInput) {
  switch (input.sourceType) {
    case "JUDGMENT": return judgmentEvidenceLine(input);
    case "MARKET": return "一覧を流す前に、一回止まる理由だけ残せば十分です。";
    case "COMPARISON": return "安さで並べても、最後は見たい空気がある方に寄ります。";
    case "HIDDEN_GEM": return hiddenGemJudgmentLine(input);
    case "ACTRESS_TREND": return actressTrendJudgmentLine(input);
    case "PRICE_EVENT": return "半額だけでなく評価も高いので、気になっていたなら今日は見ていいと思います。";
    default: return null;
  }
}
