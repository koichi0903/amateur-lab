import assert from "node:assert/strict";
import test from "node:test";
import { calculateMyfansOpportunityScores, type MyfansScoreInput } from "../myfansScore";

test("opportunity scoring preserves measured performance and observed evidence weighting", () => {
  const input: MyfansScoreInput = {
    price: 2500,
    rewardRate: 50,
    planSignupReward: 1000,
    recurringRewardRate: 10,
    popularityRank: 12,
    likesCount: 120,
    savesCount: 60,
    isNew: true,
    hasAffiliateUrl: true,
    hasApprovedMedia: false,
    source_x_url: "https://x.com/creator/status/1",
    creatorProductCount: 4,
    pastImpressions: 10_000,
    pastClicks: 50,
    pastConversions: 4,
    pastReward: 1200,
    observedUpdateCount30d: 6,
    planSignupEvidenceCount: 1,
    competitorExposureScore: 20,
  };

  assert.deepEqual(calculateMyfansOpportunityScores(input), {
    growthScore: 87,
    revenueScore: 44,
    creatorLtvScore: 43,
    expectedRewardPer1000Impressions: 120,
    confidence: 1,
    labels: ["成長向き"],
    reason: "反応90 / 新しさ100 / pastReward ¥1,200 / 24時間CV推定を信頼度100%で補正。プラン加入可能性は実績で評価、競合露出は実績で評価。",
  });
});

test("opportunity scoring keeps modeled defaults when performance evidence is missing", () => {
  const input: MyfansScoreInput = {
    price: 0,
    rewardRate: 0,
    planSignupReward: 1000,
    recurringRewardRate: 0,
    popularityRank: null,
    likesCount: 0,
    savesCount: 0,
    isNew: true,
    hasAffiliateUrl: false,
    hasApprovedMedia: false,
  };

  assert.deepEqual(calculateMyfansOpportunityScores(input), {
    growthScore: 49,
    revenueScore: 15,
    creatorLtvScore: 26,
    expectedRewardPer1000Impressions: 50,
    confidence: 0,
    labels: ["成長向き"],
    reason: "反応0 / 新しさ100 / pastReward ¥0 / 24時間CV推定を信頼度0%で補正。プラン加入可能性は客観データなしで未評価、競合露出は客観データなしで除外。",
  });
});
