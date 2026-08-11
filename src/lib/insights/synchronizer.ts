import type { Insight } from "./types";

export interface InsightDiff {
  insert: Insight[];
  update: Insight[];
  remove: Insight[];
}

export class InsightSynchronizer {
  synchronize(
    current: Insight[],
    next: Insight[],
  ): InsightDiff {
    // 実装は次ステップ
    return {
      insert: [],
      update: [],
      remove: [],
    };
  }
}