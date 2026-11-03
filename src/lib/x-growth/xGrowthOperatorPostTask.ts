const ACCOUNTS = new Set(["hakkutsu_lab", "bijyo1010"]);

export type OperatorPostTask = {
  account: string;
  postKey: string;
  workId: number;
  title: string;
  postText: string;
  postDate: string;
};

export type OperatorPostTaskValidation = OperatorPostTask | { error: string };

function asPayloadRecord(value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function normalizeOperatorPostTask(value: unknown): OperatorPostTask {
  const payload = asPayloadRecord(value);
  const account = typeof payload?.account === "string" ? payload.account.trim().toLowerCase() : "";
  const postKey = typeof payload?.postKey === "string" ? payload.postKey.trim() : "";
  const workId = Number(payload?.workId);
  const title = typeof payload?.title === "string" ? payload.title.trim() : "";
  const postText = typeof payload?.postText === "string" ? payload.postText.trim() : "";
  const postDate = typeof payload?.postDate === "string" ? payload.postDate.trim() : "";
  return { account, postKey, workId, title, postText, postDate };
}

function isValidOperatorPostTask(task: OperatorPostTask) {
  return (
    ACCOUNTS.has(task.account) &&
    /^[a-zA-Z0-9_-]{1,120}$/.test(task.postKey) &&
    Number.isSafeInteger(task.workId) && task.workId > 0 &&
    Boolean(task.title) && task.title.length <= 300 &&
    Boolean(task.postText) && task.postText.length <= 1000 &&
    validDate(task.postDate)
  );
}

export function validateOperatorPostTask(value: unknown): OperatorPostTaskValidation {
  const task = normalizeOperatorPostTask(value);
  if (!isValidOperatorPostTask(task)) {
    return { error: "投稿タスクの内容が不正です。指示リンクを開き直してください。" };
  }
  return task;
}

export function operatorPostTaskConflict(
  existing: { account_handle: string; work_id: number | string | null; post_text: string },
  task: Pick<OperatorPostTask, "account" | "workId" | "postText">,
) {
  if (
    existing.account_handle !== task.account ||
    Number(existing.work_id) !== task.workId ||
    existing.post_text !== task.postText
  ) {
    return "同じ計測キーに別の投稿記録があります。キーを作り直してください。";
  }
  return null;
}
