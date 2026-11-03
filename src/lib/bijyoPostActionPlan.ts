export type BijyoPostActionPlan =
  | { kind: "invalid"; error: string }
  | { kind: "posted"; jobId: number; postId: string }
  | { kind: "skipJob"; jobId: number }
  | { kind: "skipWork"; workId: number }
  | { kind: "skipInvalid" }
  | { kind: "exclude"; jobId: number }
  | { kind: "manual"; jobId: number; workId: number }
  | { kind: "prepareVideo"; jobId: number; workId: number }
  | { kind: "manualTrim"; body: Record<string, unknown>; jobId: number; workId: number };

function buildPostedPlan(body: Record<string, unknown>, jobId: number): BijyoPostActionPlan {
  const xPostUrl = typeof body.xPostUrl === "string" ? body.xPostUrl.trim() : "";
  const match = xPostUrl.match(/^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/[^/]+\/status\/(\d+)(?:[/?#].*)?$/i);
  if (!match) return { kind: "invalid", error: "X投稿URLを入力してください（例: https://x.com/アカウント/status/投稿ID）。" };
  return { kind: "posted", jobId, postId: match[1] };
}

function buildSkipPlan(jobId: number, workId: number): BijyoPostActionPlan {
  if (Number.isSafeInteger(jobId) && jobId > 0) return { kind: "skipJob", jobId };
  if (Number.isSafeInteger(workId) && workId > 0) return { kind: "skipWork", workId };
  return { kind: "skipInvalid" };
}

function buildOtherActionPlan(action: string, body: Record<string, unknown>, jobId: number, workId: number): BijyoPostActionPlan {
  switch (action) {
    case "exclude": return { kind: "exclude", jobId };
    case "manual": return { kind: "manual", jobId, workId };
    case "prepareVideo": return { kind: "prepareVideo", jobId, workId };
    case "manualTrim": return { kind: "manualTrim", body, jobId, workId };
    default: return { kind: "invalid", error: "この画面ではX API自動投稿を利用しません。" };
  }
}

export function buildBijyoPostActionPlan(body: Record<string, unknown>): BijyoPostActionPlan {
  const action = String(body.action ?? "");
  const jobId = Number(body.jobId);
  const workId = Number(body.workId);
  if (!Number.isSafeInteger(jobId) && ["posted", "exclude"].includes(action)) return { kind: "invalid", error: "jobIdが不正です。" };
  if (action === "posted") return buildPostedPlan(body, jobId);
  if (action === "skip") return buildSkipPlan(jobId, workId);
  return buildOtherActionPlan(action, body, jobId, workId);
}
