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
  return /^(投稿本文を入力してください|正規myfansアフィリンク|期限日時|商品が見つかりません|投稿IDがありません|未対応の更新|投稿URLを入力|対象日が不正|投稿枠が不正|候補はA\/B\/C|今日のDaily Planが見つかりません|selectedは)/.test(message)
    ? message
    : "myfans操作に失敗しました。入力を確認して、時間をおいて再試行してください。";
}
