const NON_SOURCE_LINE = /^(返信先:|Replying to|リポストしました|reposted|いいね|返信|リポスト|ブックマーク|共有|表示|Views?|Likes?|Reposts?|Replies?)(?:\s|$)/i;
const METRIC_ONLY_LINE = /^[\d\s.,、。!?！？%％¥￥円+\-/:]+$/u;

export function normalizeMyfansSourceText(value: unknown, maxLength = 180) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

export function extractMyfansSourceText(tweetText: unknown, articleText: unknown, maxLength = 180) {
  const direct = normalizeMyfansSourceText(tweetText, maxLength);
  if (direct) return direct;
  const raw = typeof articleText === "string" ? articleText : "";
  const lines = raw.split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length >= 3)
    .filter((line) => !NON_SOURCE_LINE.test(line))
    .filter((line) => !METRIC_ONLY_LINE.test(line))
    .filter((line) => !/^https?:\/\//i.test(line));
  return normalizeMyfansSourceText(lines.join(" "), maxLength);
}
