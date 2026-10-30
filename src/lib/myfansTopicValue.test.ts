import assert from "node:assert/strict";
import { discoveryInsightFromTopic } from "./myfansTopicValue";
import type { MyfansTopicValue } from "./myfansQuotePool";

function topic(reason: string, evidence: string): MyfansTopicValue {
  return {
    score: 90,
    verdict: "PASS",
    reasonToCare: reason as MyfansTopicValue["reasonToCare"],
    evidence: [evidence],
    baseline: [],
    whyRejected: [],
    breakdown: { surprise: 10, concreteDifference: 10, humanCuriosity: 10, socialProofMomentum: 10, visualStoryValue: 10, explainability: 10 },
  };
}

assert.deepEqual(discoveryInsightFromTopic(topic("rapid_growth", "X表示120,000で全体上位100%")), {
  line: "12万回も見られているなら、流れてきた理由がある。",
  value: "桁だけで押さず、元投稿の場面まで確認できる時だけ使いたい。",
});
assert.deepEqual(discoveryInsightFromTopic(topic("rapid_growth", "X表示5,000で全体上位80%")), {
  line: "X表示5,000で全体上位80%",
  value: "桁だけで押さず、元投稿の場面まで確認できる時だけ使いたい。",
});
assert.deepEqual(discoveryInsightFromTopic(topic("creator_outlier", "creator通常中央値100いいね")), {
  line: "creator通常中央値100いいね",
  value: "普段との差が見えるから、ただの新着より先に引っかかる。",
});
assert.deepEqual(discoveryInsightFromTopic(topic("clear_comparison", "同価格帯中央値100いいね")), {
  line: "同価格帯中央値100いいね",
  value: "価格だけではなく、同じ条件の中で反応が違う。",
});
assert.deepEqual(discoveryInsightFromTopic(topic("ranking_anomaly", "人気1位で、いいねも全体上位90%")), {
  line: "人気1位で、いいねも全体上位90%",
  value: "順位だけでなく、反応まで一緒に上がっている。",
});
assert.deepEqual(discoveryInsightFromTopic(topic("visual_gap", "verified visual: 表情が切り替わる")), {
  line: "表情が切り替わる",
  value: "数字より先に、見た瞬間の違いがある。",
});
assert.deepEqual(discoveryInsightFromTopic(topic("unexpected_popularity", "Xいいね1,200で全体上位100%")), {
  line: "Xいいね1,200で全体上位100%",
  value: "数字だけでなく、元投稿の見せ場まで見えてから出したい。",
});
assert.equal(discoveryInsightFromTopic(topic("rapid_growth", "")), null);
assert.equal(discoveryInsightFromTopic({ ...topic("rapid_growth", "X表示120,000"), reasonToCare: null }), null);

console.log("myfans Topic Value insight tests passed");
