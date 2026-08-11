export const UPDATE_CONFIG = {
  parallel: 5,

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