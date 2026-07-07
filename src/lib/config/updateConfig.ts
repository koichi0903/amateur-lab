/**
 * 発掘LAB 更新設定
 *
 * v1.0正式版
 *
 * 更新ルールはこのファイルで一元管理する。
 * コード内へ数値を直書きしない。
 */

export const UPDATE_CONFIG = {
  /**
   * 発売から何日を新作とするか
   */
  NEW_WORK_DAYS: 30,

  /**
   * 準新作の終了日
   * （31〜180日）
   */
  SEMI_NEW_WORK_DAYS: 180,

  /**
   * Playwright更新バッチ数
   */
  BATCH_SIZE: 10,

  /**
   * 並列実行数
   */
  CONCURRENT_LIMIT: 10,

  /**
   * セールCron
   */
  SALE_CRON: [
    "00:15",
    "10:15",
  ],

  /**
   * 通常更新曜日
   */
  NORMAL_UPDATE: {
    monday: "new",
    tuesday: "semi-new-a",
    wednesday: "semi-new-b",
    thursday: "semi-new-c",
    friday: "old",
  },
} as const;