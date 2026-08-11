import type { Insight } from "./types";
import type { InsightContext } from "./context";

export interface InsightRule {
  readonly type: string;

  generate(context: InsightContext): Insight[];
}