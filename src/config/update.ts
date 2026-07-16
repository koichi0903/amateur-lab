export const UPDATE_CONFIG = {
  parallel: 3,

  saveInterval: 6,

  batchSize: 100,

  newReleaseDays: 30,

  semiNewReleaseDays: 180,

  normalUpdatePerWeek: 2,

  saleUpdateHours: [
    "00:15",
    "10:15",
  ],

  semiNewUpdateDays: [2, 5],

  jobUpdateInterval: 6,

  CRON: {
    SALE: [
      "00:30",
      "10:30",
    ],

    RESERVE: "03:00",

    NEW: "03:30",

    OLD: {
      day: "sunday",
      time: "12:00",
    },

    SEMI_NEW: {
      day: "sunday",
      time: "14:00",
    },
  },
};