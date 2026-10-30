import type { AffiliatePerformanceRow } from "@/lib/affiliateSalesAnalytics";
import type { FanzaXGrowth } from "@/lib/fanzaXAccountGrowth";
import type { XCreativeLearningRow, XPostLog } from "@/lib/xPostLogs";
import type { XDailyMission, XGrowthIntent, XGrowthOpportunity } from "@/lib/xGrowthOS";

export function buildStrategicMission(growth: FanzaXGrowth, outcomes: XPostLog[], persistedLearning: XCreativeLearningRow[]): XDailyMission {
  const profileRate = growth.impressions30d > 0 ? growth.profileVisits30d / growth.impressions30d : 0;
  const followRate = growth.profileVisits30d > 0 ? growth.newFollows30d / growth.profileVisits30d : 0;
  const siteRate = growth.impressions30d > 0 ? growth.xPageViews30d / growth.impressions30d : 0;
  const affiliateRate = growth.xPageViews30d > 0 ? growth.fanzaClicks30d / growth.xPageViews30d : 0;
  const lastMoney = outcomes.filter((log) => log.post_intent === "work_link").slice(0, 20);
  const weakMoney = lastMoney.length >= 5 && growth.fanzaClicks30d < lastMoney.length;
  const weak: XGrowthIntent = growth.impressions30d < 1000 ? "REACH"
    : profileRate < 0.015 ? "AUTHORITY"
      : followRate < 0.08 ? "FOLLOW"
        : siteRate < 0.01 || affiliateRate < 0.08 || weakMoney ? "MONEY"
          : "CONVERSATION";
  const mixes: Record<XGrowthIntent, Record<XGrowthIntent, number>> = {
    REACH: { REACH: 3, AUTHORITY: 1, FOLLOW: 0, CONVERSATION: 1, MONEY: 1 },
    AUTHORITY: { REACH: 1, AUTHORITY: 3, FOLLOW: 1, CONVERSATION: 1, MONEY: 1 },
    FOLLOW: { REACH: 1, AUTHORITY: 2, FOLLOW: 2, CONVERSATION: 1, MONEY: 1 },
    MONEY: { REACH: 1, AUTHORITY: 1, FOLLOW: 0, CONVERSATION: 0, MONEY: 3 },
    CONVERSATION: { REACH: 1, AUTHORITY: 1, FOLLOW: 1, CONVERSATION: 2, MONEY: 1 },
  };
  const label: Record<XGrowthIntent, XDailyMission["bottleneck"]> = {
    REACH: "Reach不足",
    AUTHORITY: "Profile Visit不足",
    FOLLOW: "Follow不足",
    MONEY: "収益導線不足",
    CONVERSATION: "会話接点不足",
  };
  const strongest = persistedLearning[0]?.label;
  return {
    bottleneck: label[weak],
    title: `明日は${weak}を最優先にする`,
    reason: `直近実績から ${weak} が最も弱い配分です。${strongest ? `勝ち寄りの ${strongest} は維持します。` : "十分な学習データがないため、結果取得を優先します。"}`,
    mix: mixes[weak],
    actions: [
      { intent: weak, label: `${weak}枠を増やす`, detail: "採用候補と投稿結果を同じopportunityに紐付けて翌日判断に使う" },
      { intent: "MONEY", label: "既存リンク画像は維持", detail: "画像は変えず、文面と投稿タイミングだけ比較する" },
      { intent: "CONVERSATION", label: "会話は人間確認", detail: "候補化まで。無差別返信や自動返信は行わない" },
    ],
  };
}

export function buildSeriesIdeas(performance: AffiliatePerformanceRow[], opportunities: XGrowthOpportunity[]) {
  const ideas = opportunities.filter((item) => item.isNinetyDayLow || item.xPageViews >= 3 || item.ranking && item.ranking <= 50).slice(0, 8).map((item) => ({
    key: `series-${item.key}`,
    title: item.isNinetyDayLow ? "今週の過去最安" : item.xPageViews >= 3 ? "24時間急上昇候補" : "今日の異常値",
    detail: `${item.title} / ${item.evidence.slice(0, 2).join(" / ")}`,
  }));
  if (ideas.length) return ideas;
  return performance.filter((row) => row.salesCount > 0).slice(0, 4).map((row) => ({
    key: `sales-follow-${row.workId}`,
    title: "昨日の注目作その後",
    detail: `販売実績がある作品ID ${row.workId} を続報候補として確認`,
  }));
}
