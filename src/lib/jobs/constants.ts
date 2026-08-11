export const JOBS = {
  ALL: "all",

  SYNC: "sync",

  STAGE: "stage",

  NEW_UPDATE: "new_update",

  RESERVE: "reserve",

  SEMI_NEW: "semi_new",

  OLD: "old",

  SALE: "sale",

  ENDED_SALE: "ended_sale",

REVIEW: "review",

RANKING: "ranking",

SCORE: "score",

  MISSING_PRICES: "missing_prices",
} as const;

export type JobName =
  (typeof JOBS)[keyof typeof JOBS];