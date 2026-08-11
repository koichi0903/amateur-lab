export interface RankingItem {
  name: string;
  rank?: number;
  score: number;
}

export interface ActressRankingItem {
  name: string;

  // 発掘LABランキング
  original_rank: number | null;

  // FANZAランキング
  fanza_rank: number | null;
}