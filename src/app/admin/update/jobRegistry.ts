export const JOB_REGISTRY = {
  sync: {
    title: "📥 作品同期",
    order: 1,
    api: "/api/sync",
    method: "POST",
    visible: true,
  },

  new_update: {
    title: "🆕 新作更新",
    order: 2,
    api: "/api/update-new",
    method: "POST",
    visible: true,
  },

  stage: {
    title: "🏷 Stage同期",
    order: 3,
    api: "/api/sync/update-stage",
    method: "POST",
    visible: true,
  },

  reserve: {
    title: "📅 予約作品更新",
    order: 3.5,
    api: "/api/update-reserve",
    method: "POST",
    visible: true,
  },

  semi_new: {
    title: "⭐ 準新作更新",
    order: 4,
    api: "/api/update-semi-new",
    method: "POST",
    visible: true,
  },

  old: {
    title: "📦 旧作更新",
    order: 5,
    api: "/api/update-old",
    method: "POST",
    visible: true,
  },

  sale: {
    title: "💰 セール更新",
    order: 6,
    api: "/api/update-sale",
    method: "POST",
    visible: true,
  },

  ended_sale: {
    title: "🔚 終了セール更新",
    order: 7,
    api: "/api/update-ended-sale",
    method: "POST",
    visible: true,
  },

  review: {
    title: "📝 レビュー更新",
    order: 8,
  },

  ranking: {
    title: "🏆 人気ランキング",
    order: 9,
  },

  score: {
    title: "🧠 スコア更新",
    order: 10,
    api: "/api/score-update",
    method: "POST",
    visible: true,
  },

  missing_prices: {
    title: "💵 価格補完",
    order: 11,
    api: "/api/update-missing-prices",
    method: "POST",
    visible: true,
  },
} as const;