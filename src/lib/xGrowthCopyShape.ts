import type { XCreativeVariant } from "./xCreativeEngine";

type SubjectStructureSource = {
  actress?: string | null;
  genre?: string | null;
};

const SUBJECT_STRUCTURE_KEYWORD_RULES = [
  { terms: ["今日", "一覧", "セール欄"], category: "market_first" },
  { terms: ["似た", "同じ"], category: "comparison_first" },
  { terms: ["見送"], category: "judgment_first" },
  { terms: ["価格", "安い", "OFF"], category: "price_first" },
] as const;

export function firstLine(text: string) {
  return text.split("\n").map((line) => line.trim()).find(Boolean) ?? "";
}

export function judgmentPhrase(text: string) {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  return [...lines].reverse().find((line) => !/^https?:\/\//.test(line) && !line.startsWith("「")) ?? "";
}

export function openingPattern(text: string) {
  const line = firstLine(text);
  if (line.includes("タイトルだけ")) return "title_missed";
  if (line.includes("セール欄")) return "sale_shelf";
  if (line.includes("ランキング")) return "ranking_first";
  if (line.includes("評価")) return "rating_first";
  if (line.includes("今日の")) return "today_market";
  if (line.includes("目当て") || line.includes("女優")) return "actress_view";
  if (line.includes("似た条件") || line.includes("同じ")) return "comparison";
  if (line.includes("安い") || line.includes("価格")) return "price_event";
  return line.replace(/[0-9０-９]+/g, "#").slice(0, 18);
}

export function sentenceStructure(text: string) {
  return text.split("\n").map((line) => {
    if (/^https?:\/\//.test(line)) return "link";
    if (line.startsWith("「")) return "title";
    if (/評価|レビュー|ランキング|OFF|円|過去90日/.test(line)) return "proof";
    if (/見る|判断|拾|決め|流|残|惜しい|安全/.test(line)) return "judgment";
    return "story";
  }).join(">");
}

export function endingPhrase(text: string) {
  return (text.split("\n").map((line) => line.trim()).filter(Boolean).at(-1) ?? "")
    .replace(/[0-9０-９]+/g, "#")
    .slice(0, 18);
}

export function numberPlacement(text: string) {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const positions = lines.map((line, index) => /[0-9０-９]/.test(line) ? String(index + 1) : "").filter(Boolean);
  return positions.length ? positions.join(",") : "none";
}

export function subjectStructure(item: SubjectStructureSource, text: string) {
  const opening = firstLine(text);
  const actress = item.actress?.split(/[,、/]/)[0]?.trim();
  const genre = item.genre?.split(/[,、/]/)[0]?.trim();
  const entityCategory = [
    { subject: actress, category: "actress_first" },
    { subject: genre, category: "genre_first" },
  ].find(({ subject }) => Boolean(subject && opening.includes(subject)))?.category;
  const keywordCategory = SUBJECT_STRUCTURE_KEYWORD_RULES.find(({ terms }) =>
    terms.some((term) => opening.includes(term)),
  )?.category;
  return entityCategory ?? keywordCategory ?? "work_first";
}

export function reactionType(variant: Pick<XCreativeVariant, "hookDirection">) {
  const reactions: Record<XCreativeVariant["hookDirection"], string> = {
    curiosity: "discovery", contradiction: "tension", hot_take: "changed_mind", follow_up: "conversation",
    comparison: "comparison", social_proof: "social_proof", confession: "confession", missed: "missed_then_noticed",
    surprise: "surprise", empathy: "empathy", question: "question", surprising_concentration: "market_pattern",
    contrast: "contrast", curation: "curation", anti_obvious: "anti_obvious", pattern_break: "pattern_break", selection_tension: "selection_tension",
  };
  return reactions[variant.hookDirection];
}

export function judgmentShape(text: string, direction?: XCreativeVariant["hookDirection"]) {
  if (direction === "follow_up" || direction === "question") return "conversation_open";
  if (direction === "comparison" || direction === "contrast") return "compare_then_choose";
  if (direction === "hot_take" || direction === "anti_obvious") return "reject_obvious";
  if (direction === "missed" || direction === "confession") return "reconsider";
  if (direction === "social_proof") return "trust_signal";
  if (direction === "surprise" || direction === "pattern_break") return "notice_change";
  if (/見送|急がなくて|即決/.test(text)) return "defer";
  if (/見ておきたい|見たい|戻りそう/.test(text)) return "watch_next";
  if (/止める|残る|気になる/.test(text)) return "stop_on_reaction";
  if (/決め|選び|比べ/.test(text)) return "choose";
  return "open_observation";
}

export function textSimilarity(a: string, b: string) {
  const tokens = new Set(a.replace(/[【】「」。、\s]/g, "").split("").filter(Boolean));
  const other = new Set(b.replace(/[【】「」。、\s]/g, "").split("").filter(Boolean));
  return [...tokens].filter((token) => other.has(token)).length / Math.max(tokens.size, other.size, 1);
}
