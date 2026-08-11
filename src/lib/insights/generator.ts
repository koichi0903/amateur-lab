import type { Insight } from "./types";
import type { InsightContext } from "./context";
import type { InsightRule } from "./InsightRule";

export class InsightGenerator {
  constructor(
    private readonly rules: InsightRule[],
  ) {}

  generate(context: InsightContext): Insight[] {
    const insights: Insight[] = [];

    for (const rule of this.rules) {
      const result = rule.generate(context);

      if (result.length > 0) {
        insights.push(...result);
      }
    }

    return insights;
  }
}
