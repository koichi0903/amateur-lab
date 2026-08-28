export const UPDATE_CONFIG = {
  // A single serverless Chromium process is memory constrained on Vercel.
  // Opening five FANZA pages at once can terminate the entire browser process.
  parallel: process.env.VERCEL ? 1 : 5,
  saveInterval: 6,

  batchSize: 100,

  browserRestartInterval: 100,

  normalUpdatePerWeek: 2,

  saleUpdateHours: [
    "00:15",
    "10:15",
  ],

  semiNewUpdateDays: [2, 5],

  jobUpdateInterval: 6,

  CRON: {
  NIGHT: "00:30",

  DAY: "10:30",

  SEMI_NEW: {
    days: ["monday", "friday"],
    time: "18:00",
  },
},
};

export const RANKING_UPDATE_CONFIG = {
  targetCount: 3000,
  apiPageSize: 100,
  fanzaItemsPerPage: 120,
} as const;
