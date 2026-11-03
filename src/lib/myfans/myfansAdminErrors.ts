const SAFE_MYFANS_ADMIN_MESSAGES = new Set([
  "投稿本文を入力してください。",
  "期限日時の形式を確認してください。",
  "商品が見つかりません。",
  "投稿IDがありません。",
  "未対応の更新です。",
  "投稿URLを入力してください。",
  "対象日が不正です",
  "対象日が不正です。",
  "投稿枠が不正です。",
  "候補はA/B/Cから選んでください。",
  "今日のDaily Planが見つかりません。先に候補を生成してください。",
]);

const SAFE_SELECTED_LIMIT_MESSAGE = /^selectedは\d+件までです。4枠目を選ぶには、既存のselectedを見直してください。$/;

export function buildMyfansAdminErrorContext(action: string, error: unknown) {
  const errorRecord = typeof error === "object" && error !== null
    ? error as { code?: unknown }
    : undefined;
  const errorCode = typeof errorRecord?.code === "string" && /^[0-9A-Z]{5}$/.test(errorRecord.code)
    ? errorRecord.code
    : undefined;

  return {
    action: /^[a-z_]{1,64}$/.test(action) ? action : "unknown",
    errorCode,
    errorType: error instanceof Error ? error.name : "UnknownError",
  };
}

export function getSafeMyfansAdminErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return SAFE_MYFANS_ADMIN_MESSAGES.has(message) || SAFE_SELECTED_LIMIT_MESSAGE.test(message)
    ? message
    : "myfans操作に失敗しました。入力を確認して、時間をおいて再試行してください。";
}
