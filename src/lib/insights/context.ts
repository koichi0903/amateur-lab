export interface InsightContext {
  workId: number;
  title: string;
  listPrice: number;
  currentPrice: number;
  lowestPrice: number | null;
  previousRealtimeRank?: number | null;
realtimeRank?: number | null;
}