export const JOBS = {
  ALL: "all",
  NEW: "new",
  SEMI_NEW: "semi_new",
  OLD: "old",
  SALE: "sale",
  STAGE: "stage",
} as const;

export type JobName =
  (typeof JOBS)[keyof typeof JOBS];