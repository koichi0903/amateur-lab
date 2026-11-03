import { decisionFactProofLine } from "@/lib/domain/decisionFacts";
import { strongestFacts } from "./xCreativeInputFacts";
import type { XCreativeInput, XGrowthIntent } from "./xCreativeTypes";

export function humanProofLine(input: XCreativeInput, intent: XGrowthIntent) {
  const decisionProof = input.decisionFacts ? decisionFactProofLine(input.decisionFacts) : "";
  if (decisionProof) return decisionProof;
  const facts = strongestFacts(input);
  if (!facts.length) return "";
  if (intent === "MONEY") {
    if (input.isNinetyDayLow) return input.reviewAverage && input.reviewAverage >= 4.6 ? `${facts.find((fact) => fact.startsWith("評価")) ?? ""} / 過去90日最安級`.replace(/^ \/ /, "") : "過去90日最安級";
    return facts[0];
  }
  return facts.slice(0, 1).join(" / ");
}
