/**
 * 発掘LAB 更新設定
 *
 * 更新システムの設定を一元管理する。
 * 更新ロジック側へ数値・時刻を直書きしない。
 */

export const UPDATE_CONFIG = {
  /**
   * Playwright
   */
  BATCH_SIZE: 10,

  /**
   * 並列実行数
   */
  CONCURRENT_LIMIT: 10,

  /**
   * 自動更新スケジュール
   */
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
} as const;