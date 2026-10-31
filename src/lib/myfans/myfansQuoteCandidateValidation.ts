const X_STATUS_URL_PATTERN = /^https:\/\/(x\.com|twitter\.com)\/[^/\s]+\/status\/\d+/;
const X_HANDLE_PATTERN = /(?:x\.com|twitter\.com)\/([^/?#]+)/;

export function assertMyfansQuoteCandidateOwner(creatorXUrl: string | null | undefined, quoteUrl: string) {
  if (!X_STATUS_URL_PATTERN.test(quoteUrl)) {
    throw new Error("creator本人のX投稿URLを入力してください。");
  }
  if (!creatorXUrl) return;

  const creatorHandle = String(creatorXUrl).match(X_HANDLE_PATTERN)?.[1]?.toLowerCase();
  const quoteHandle = quoteUrl.match(X_HANDLE_PATTERN)?.[1]?.toLowerCase();
  if (creatorHandle && quoteHandle && creatorHandle !== quoteHandle) {
    throw new Error("creator本人のX投稿URLだけ登録できます。");
  }
}
