export const JOBS = {
  ALL: "all",

  SYNC: "sync",

  STAGE: "stage",

  NEW: "new",

  RESERVE: "reserve",

  SEMI_NEW: "semi_new",

  OLD: "old",

  SALE: "sale",

  ENDED_SALE: "ended_sale",

  RANKING: "ranking",

  SCORE: "score",

  MISSING_PRICES: "missing_prices",
} as const;

export type JobName =
  (typeof JOBS)[keyof typeof JOBS];