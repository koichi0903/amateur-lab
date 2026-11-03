import type { XCreativeLearningRow, XPostLog, XPostOutcome } from "@/lib/xPostLogs";
import { normalizedOpening } from "./xGrowthSupplyDiagnostics";
import { DAY_MS } from "./xGrowthTime";

function patternFromLog(log: XPostLog) {
  const text = log.post_text;
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const opening = normalizedOpening(text);
  const ending = lines.at(-1) ?? "";
  const structure = lines.map((line) => /評価|ランキング|OFF|円|レビュー/.test(line) ? "proof" : /http/.test(line) ? "link" : "story").join("+");
  const hook = log.hook_type ?? String(log.creative_genome?.hook ?? "unknown");
  const media = String(log.creative_genome?.media ?? log.image_strategy ?? "unknown");
  return `${opening} / ${structure} / ${hook} / ${media} / ${ending.slice(0, 16)}`;
}

export function buildNativeXLearning(logs: XPostLog[], outcomes: XPostOutcome[]) {
  const cutoff = Date.now() - 7 * DAY_MS;
  const recent = logs.filter((log) => new Date(log.posted_at).getTime() >= cutoff);
  const counts = new Map<string, number>();
  for (const log of recent) {
    const key = patternFromLog(log);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const overusedPatterns = [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([pattern, count]) => `${pattern} (${count}回)`);
  const winningPatterns = outcomes
    .filter((outcome) => outcome.status === "winner" || outcome.clicksSevenDays > 0 || outcome.follows24h > 0 || outcome.profileVisits24h > 0)
    .slice(0, 5)
    .map((outcome) => patternFromLog(outcome).replace(/^[^/]+\//, "感想始まり +"));
  const phraseCounts = new Map<string, number>();
  for (const log of recent) {
    for (const line of log.post_text.split("\n").map((item) => item.trim()).filter((item) => item.length >= 8 && item.length <= 24)) {
      phraseCounts.set(line, (phraseCounts.get(line) ?? 0) + 1);
    }
  }
  const avoidConstructions = [...phraseCounts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([phrase, count]) => `${phrase} (${count}回)`);
  return { overusedPatterns, winningPatterns, avoidConstructions };
}

export function buildLearning(rows: XCreativeLearningRow[], outcomes: XPostOutcome[]) {
  const creativeFindings = rows.slice(0, 5).map((row) => ({
    key: `${row.dimension}-${row.value}`,
    label: row.label,
    finding: `${row.posts}投稿 / 補正CTR ${row.adjustedCtr}% / ${row.recommendation}`,
    strength: row.confidence === "high" && row.adjustedCtr >= 8 ? "strong" as const : row.adjustedCtr <= 3 ? "weak" as const : "watch" as const,
  }));
  const intentFindings = outcomes.slice(0, 4).map((outcome) => ({
    key: `outcome-${outcome.id}`,
    label: outcome.title,
    finding: `24h表示 ${outcome.impressions24h} / プロフ ${outcome.profileVisits24h} / フォロー ${outcome.follows24h} / 7日クリック ${outcome.clicksSevenDays}`,
    strength: outcome.status === "winner" ? "strong" as const : outcome.status === "replace" ? "weak" as const : "watch" as const,
  }));
  return [...creativeFindings, ...intentFindings].slice(0, 8);
}
