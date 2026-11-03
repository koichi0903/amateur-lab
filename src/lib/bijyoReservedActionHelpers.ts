export type BijyoReservedAction = "posted" | "skip" | "exclude" | "manual";

export type BijyoReservedActionResult = {
  trim?: { ok?: boolean; error?: string; trimStartSeconds?: number };
};

export function getBijyoReservedActionSuccessMessage(action: BijyoReservedAction, result: BijyoReservedActionResult) {
  if (action === "posted") return "投稿済みにしました。X投稿URLを計測に紐付けました。";
  if (action === "skip") return "スキップして候補を補充しました。";
  if (action === "exclude") return "今後の候補から外しました。";
  if (result.trim?.ok === false) return `手動追加は完了しましたが、trim準備に失敗しました。動画ボタンから再生成できます。\n${result.trim.error}`;
  return "手動追加・trim準備が完了しました。画面を更新します。";
}

export async function runBijyoReservedAction(input: {
  action: BijyoReservedAction;
  promptXPostUrl: () => string | null;
  request: (action: BijyoReservedAction, xPostUrl: string | null) => Promise<BijyoReservedActionResult>;
  setBusy: (busy: boolean) => void;
  setMessage: (message: string) => void;
  setActionBlocked: (blocked: boolean) => void;
  isAlreadySelected: (error: unknown) => boolean;
  reload: () => void;
}) {
  input.setBusy(true);
  input.setMessage("");
  try {
    const xPostUrl = input.action === "posted" ? input.promptXPostUrl() : null;
    if (input.action === "posted" && !xPostUrl?.trim()) {
      input.setMessage("計測に必要なX投稿URLがないため、投稿済み登録を中止しました。");
      return;
    }
    const result = await input.request(input.action, xPostUrl);
    input.setMessage(getBijyoReservedActionSuccessMessage(input.action, result));
    if (["posted", "skip", "exclude", "manual"].includes(input.action)) input.reload();
  } catch (error) {
    if (input.isAlreadySelected(error)) input.setActionBlocked(true);
    input.setMessage(error instanceof Error ? error.message : String(error));
  } finally {
    input.setBusy(false);
  }
}
