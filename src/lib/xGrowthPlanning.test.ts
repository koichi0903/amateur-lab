import assert from "node:assert/strict";
import test from "node:test";
import type { FanzaXGrowth } from "@/lib/fanzaXAccountGrowth";
import type { XCreativeLearningRow, XPostLog } from "@/lib/xPostLogs";
import { buildStrategicMission } from "./xGrowthPlanning.ts";

function growth(overrides: Partial<FanzaXGrowth> = {}): FanzaXGrowth {
  return {
    error: null,
    diagnosis: "露出不足",
    currentFollowers: 100,
    followersDelta30d: 0,
    newFollows30d: 2,
    profileVisits30d: 15,
    impressions30d: 1000,
    posts30d: 5,
    avgImpressionsPerPost: 200,
    xPageViews30d: 10,
    fanzaClicks30d: 1,
    salesCount30d: 0,
    commission30d: 0,
    ctr30d: 0.01,
    cvr30d: 0,
    epc30d: null,
    weeklyRows: [],
    ...overrides,
  };
}

function workLinkLogs(count: number): XPostLog[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    post_key: `post-${index + 1}`,
    work_id: index + 1,
    category: "new" as const,
    title: "作品",
    post_text: "本文",
    post_date: "2026-10-31",
    posted_at: "2026-10-31T00:00:00.000Z",
    post_intent: "work_link" as const,
  }));
}

function learning(label: string): XCreativeLearningRow {
  return {
    dimension: "hook_type",
    value: "price_anomaly",
    label,
    posts: 5,
    xPageViews: 10,
    xFanzaClicks: 2,
    rawCtr: 0.1,
    adjustedCtr: 0.1,
    clicksPerPost: 0.4,
    confidence: "high",
    recommendation: "維持",
  };
}

test("mission bottleneck thresholds retain their strict priority and boundaries", () => {
  assert.equal(buildStrategicMission(growth({ impressions30d: 999, profileVisits30d: 0 }), [], []).bottleneck, "Reach不足");
  assert.equal(buildStrategicMission(growth({ profileVisits30d: 14, newFollows30d: 0 }), [], []).bottleneck, "Profile Visit不足");
  assert.equal(buildStrategicMission(growth({ newFollows30d: 1 }), [], []).bottleneck, "Follow不足");
  assert.equal(buildStrategicMission(growth({ xPageViews30d: 9 }), [], []).bottleneck, "収益導線不足");
  assert.equal(buildStrategicMission(growth({ fanzaClicks30d: 0 }), [], []).bottleneck, "収益導線不足");
  assert.equal(buildStrategicMission(growth(), [], []).bottleneck, "会話接点不足");
});

test("weak-money detection requires five work-link outcomes and counts at most twenty", () => {
  assert.equal(buildStrategicMission(growth({ fanzaClicks30d: 4 }), workLinkLogs(5), []).bottleneck, "収益導線不足");
  assert.equal(buildStrategicMission(growth({ fanzaClicks30d: 1 }), workLinkLogs(4), []).bottleneck, "会話接点不足");
  assert.equal(buildStrategicMission(growth({ fanzaClicks30d: 5 }), workLinkLogs(5), []).bottleneck, "会話接点不足");
  assert.equal(buildStrategicMission(growth({ fanzaClicks30d: 20 }), workLinkLogs(21), []).bottleneck, "会話接点不足");
});

test("mission output preserves intent mix, actions, and the first learning label", () => {
  const mission = buildStrategicMission(
    growth({ impressions30d: 999 }),
    [],
    [learning("価格フック"), learning("後続ラベル")],
  );

  assert.equal(mission.title, "明日はREACHを最優先にする");
  assert.equal(mission.reason, "直近実績から REACH が最も弱い配分です。勝ち寄りの 価格フック は維持します。");
  assert.deepEqual(mission.mix, { REACH: 3, AUTHORITY: 1, FOLLOW: 0, CONVERSATION: 1, MONEY: 1 });
  assert.deepEqual(mission.actions.map(({ intent }) => intent), ["REACH", "MONEY", "CONVERSATION"]);
  assert.equal(buildStrategicMission(growth({ impressions30d: 999 }), [], []).reason,
    "直近実績から REACH が最も弱い配分です。十分な学習データがないため、結果取得を優先します。");
});
