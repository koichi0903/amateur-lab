import type { MyfansAnalytics } from "@/lib/myfansAnalytics";
import { quoteInsight } from "@/lib/myfans/myfansCreativeEvidence";
import { buildMyfansLearning, MYFANS_DIAGNOSIS_THRESHOLDS } from "@/lib/myfans/myfansLearning";
import { buildMyfansQuotePool, quoteUrlFromCandidate } from "@/lib/myfans/myfansQuotePool";
import { detectPublicCopyLeak } from "@/lib/myfans/myfansPublicCopyRules";
import type { DailyRole } from "@/lib/myfans/myfansTopicValue";
import type { AudienceIntent, MyfansCreativeStrategy, MyfansGrowthStage, MyfansLinkStrategy, MyfansObjective } from "@/lib/myfansXExecution";
type DailyCandidate = {
  postType: string;
  creativeStrategy: MyfansCreativeStrategy;
  dailyRole: DailyRole;
  plannedSlot: string;
  hookLabel: string;
  audienceIntent: AudienceIntent;
  quality: { total: number; verdict: string; reasons: string[] };
};


export function buildTodayStrategy(
  analytics: MyfansAnalytics,
  candidates: DailyCandidate[],
  heldCandidates: DailyCandidate[],
  quotePool: ReturnType<typeof buildMyfansQuotePool>,
) {
  const diagnosis = analytics.xAccountGrowth.diagnosis;
  const samplePosts = analytics.posts.filter((post) => post.status === "posted").length;
  const quoteCount = candidates.filter((candidate) => candidate.creativeStrategy === "quote_post").length;
  const discoveryCount = candidates.filter((candidate) => candidate.dailyRole === "DISCOVERY").length;
  const authorityCount = candidates.filter((candidate) => candidate.dailyRole === "AUTHORITY").length;
  const cardCount = candidates.filter((candidate) => ["ranking_card", "comparison_card", "discovery_card"].includes(candidate.creativeStrategy)).length;
  const textCount = candidates.filter((candidate) => candidate.creativeStrategy === "text_only").length;
  const revenueCount = candidates.filter((candidate) => candidate.dailyRole === "REVENUE").length;
  const topAttention = quotePool.global[0];
  const mainTheme = topAttention?.candidate.quote_visual_ready
    ? "verified visual quoteを入口にして露出を取りにいく"
    : cardCount > 0
      ? "明確な数字差がある候補だけカード化する"
      : "弱いカードを止めてtext/quote中心にする";
  const changed = [
    "日付ごとのplan keyで候補順に変化を入れました",
    heldCandidates.length ? `Quality Gate未達 ${heldCandidates.length}本を本日の投稿から外しました` : "Quality Gateを通過した候補だけ表示しています",
    cardCount ? "Data Story Scoreが足りるカードだけ採用しています" : "価格だけの弱いカードは採用していません",
    quoteCount ? "Attention枠はverified visual quoteを優先しています" : "verified visual quote不足のため引用を主力にしていません",
  ];
  return {
    stageLabel: samplePosts < MYFANS_DIAGNOSIS_THRESHOLDS.minimumSamplePosts ? "Exposure / Learning" : diagnosis,
    kpi: diagnosis === "露出不足" ? "表示獲得 → プロフィール流入 → フォロー" : "反応が出た型 → プロフィール/クリックへ接続",
    composition: { quote: quoteCount, discovery: discoveryCount, authority: authorityCount, card: cardCount, text: textCount, revenue: revenueCount, total: candidates.length },
    mainTheme,
    winningNarrative: `今日は${mainTheme}日です。${diagnosis}のため、Revenue本数を増やすより先に、X上で止まる理由とフォロー理由を分けて検証します。`,
    changedFromYesterday: changed,
  };
}

export function buildOutboundTasks(analytics: MyfansAnalytics, quotePool: ReturnType<typeof buildMyfansQuotePool>) {
  const externalTasks = quotePool.global.slice(0, 3).map((row, index) => {
    const opening = row.candidate.text_excerpt
      ? `この「${row.candidate.text_excerpt.slice(0, 24)}」の入り方、すぐ内容が伝わるのが強いです。`
      : `${quoteInsight(row.candidate)}まで伸びているの、かなり目に留まります。`;
    const second = index === 0
      ? "こういう一目で分かれる投稿、あとで探す時に助かります。"
      : index === 1
        ? "反応の付き方まで含めて、好きな人には見つけやすいです。"
        : "別角度の比較としても覚えておきたいです。";
    const suggestedText = [opening, second].join("\n");
    const leak = detectPublicCopyLeak(suggestedText);
    return {
      id: `outbound-${row.candidate.id}`,
      type: index === 0 ? "quote_candidate" : "reply_candidate",
      targetUrl: quoteUrlFromCandidate(row.candidate),
      creator: row.candidate.source_x_handle ? `@${row.candidate.source_x_handle}` : row.candidate.creator_x_url,
      reason: row.candidate.quote_visual_ready
        ? `内部判断: ${row.candidate.media_type} / Attention ${row.globalScore}。`
        : `内部判断: Attention ${row.globalScore}。引用より返信で文脈確認。`,
      suggestedText: leak.hasLeak ? "" : suggestedText,
      guardrail: leak.hasLeak ? `HOLD: ${leak.matches.join(" / ")}` : "自動送信しません。同文の大量返信は禁止です。",
    };
  });
  return externalTasks.concat(analytics.posts.filter((post) => post.status === "posted" && (post.replies_count > 0 || post.likes_count > 0)).slice(0, 2).map((post) => ({
    id: `own-reply-${post.id}`,
    type: "own_reply_followup",
    targetUrl: post.x_post_url,
    creator: "@lumi_reviw",
    reason: `自分の投稿に反応があります。表示 ${post.impressions} / いいね ${post.likes_count} / 返信 ${post.replies_count}。`,
    suggestedText: "反応があった視点を、次の比較メモに反映します。",
    guardrail: "返信は相手の文脈が確認できる時だけ行います。",
  })));
}

export function buildProfileFunnel(analytics: MyfansAnalytics) {
  const rows = analytics.xAccountGrowth;
  const visitToFollow = rows.profileVisits30d > 0 ? rows.newFollows30d / rows.profileVisits30d : null;
  const enough = rows.profileVisits30d >= 20;
  return {
    profileHealth: rows.currentFollowers === 0 ? "初期状態" : "運用中",
    fixedPostHealth: "最低限あり。7日ごとに反応を見て改善",
    visitToFollowRate: visitToFollow,
    diagnosis: enough
      ? visitToFollow !== null && visitToFollow >= MYFANS_DIAGNOSIS_THRESHOLDS.followRate ? "プロフィールは機能しています" : "プロフィール訪問からフォローへの理由が弱い可能性があります"
      : "データ不足",
    recommendation: enough
      ? "固定ポストは、探す手間が減る約束を1行目に置いて検証します。"
      : "まず表示とプロフィール訪問の母数を作ります。",
  };
}

export function buildBottleneck(analytics: MyfansAnalytics) {
  const growth = analytics.xAccountGrowth;
  const bottleneck = growth.impressions30d < MYFANS_DIAGNOSIS_THRESHOLDS.exposureImpressions
    ? "Exposure"
    : growth.profileVisits30d <= 0
      ? "ProfileVisit"
      : growth.newFollows30d <= 0
        ? "Follow"
        : growth.clicks30d <= 0
          ? "Click"
          : growth.conversions30d <= 0
            ? "CV"
            : "Revenue";
  return {
    current: bottleneck,
    shouldIncreaseRevenue: bottleneck === "Click" || bottleneck === "CV" || bottleneck === "Revenue",
    explanation: bottleneck === "Exposure"
      ? "今はRevenue投稿を増やす段階ではありません。まず表示を増やします。"
      : bottleneck === "Follow"
        ? "プロフィールを見る人は出ていますが、フォロー理由を強くする段階です。"
        : "収益導線を少しずつ検証できます。",
  };
}


export function reasonFor(stage: MyfansGrowthStage, linkStrategy: MyfansLinkStrategy, objective: MyfansObjective) {
  if (stage === "day_1_7" && (linkStrategy === "no_link" || linkStrategy === "profile_cta")) {
    return "最初の7日は販売より、表示とプロフィール遷移を作るため。";
  }
  if (stage === "day_8_14") return "少しずつリンク型も混ぜ、反応差を見るため。";
  if (objective === "conversion") return "クリックやフォローに寄与した型を増やす段階のため。";
  return "少サンプルでは断定せず、固定ローテーションを優先します。";
}


export function summarizeTodayActions(analytics: MyfansAnalytics) {
  const samplePosts = analytics.posts.filter((post) => post.status === "posted").length;
  if (samplePosts < MYFANS_DIAGNOSIS_THRESHOLDS.minimumSamplePosts) {
    return ["Day1-7は4本で検証する", "リンクなし/プロフィール誘導を先に出す", "リンク付きは1本だけ小さく試す"];
  }
  return analytics.xAccountGrowth.diagnosis.includes("クリック")
    ? ["プロフィール誘導を1本、自己リプリンクを1本にする", "クリックが出た投稿型を再利用する"]
    : ["表示が取れた投稿型を1本再利用する", "プロフィール文と固定ポストの受け皿を見直す"];
}


function bestTrustedPattern(learning: ReturnType<typeof buildMyfansLearning>, period: "seven" | "thirty") {
  return learning[period].link_strategy.find((row) => row.verdict === "勝ち型" && row.confidence >= 0.55);
}

export function adjustRotationByLearning<T extends { linkStrategy: MyfansLinkStrategy; objective: MyfansObjective; postType: string; role: string }>(
  rotation: T[],
  stage: MyfansGrowthStage,
  learning: ReturnType<typeof buildMyfansLearning>,
) {
  if (stage === "day_1_7") return rotation;
  const sevenWinner = bestTrustedPattern(learning, "seven");
  const thirtyWinner = bestTrustedPattern(learning, "thirty");
  const winner = stage === "day_8_14" ? sevenWinner : sevenWinner ?? thirtyWinner;
  if (!winner || !["body_link", "reply_link", "profile_cta", "no_link"].includes(winner.key)) return rotation;
  return rotation.map((item, index) => index === rotation.length - 1 ? { ...item, linkStrategy: winner.key as MyfansLinkStrategy, role: `${item.role} / 学習結果を少し反映` } : item);
}

export function planningReasonFor(stage: MyfansGrowthStage, learning: ReturnType<typeof buildMyfansLearning>) {
  if (stage === "day_1_7") return "Day1-7は固定ローテーションを優先します。";
  const sevenWinner = bestTrustedPattern(learning, "seven");
  if (stage === "day_8_14") return sevenWinner ? `7日学習で信頼できる ${sevenWinner.key} に1枠だけ寄せています。` : "7日学習が少サンプルのため固定配分へフォールバックしています。";
  const thirtyWinner = bestTrustedPattern(learning, "thirty");
  return sevenWinner || thirtyWinner ? `7日/30日学習で信頼できる ${(sevenWinner ?? thirtyWinner)?.key} に寄せています。` : "7日/30日とも少サンプルのため固定配分へフォールバックしています。";
}
