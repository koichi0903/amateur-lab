import { parseXPostUrl, type ParsedXPostUrl } from "../xPostUrl";

const ACCOUNTS = new Set(["hakkutsu_lab", "bijyo1010"]);

export type XGrowthPostRegistrationInput = {
  postKey: string;
  account: string;
  post: ParsedXPostUrl;
};

export function parseXGrowthPostRegistrationInput(payload: unknown): XGrowthPostRegistrationInput | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;

  const values = payload as Record<string, unknown>;
  const postKey = typeof values.postKey === "string" ? values.postKey.trim() : "";
  const account = typeof values.account === "string" ? values.account.toLowerCase() : "";
  const xPostUrl = typeof values.xPostUrl === "string" ? values.xPostUrl.trim() : "";
  const post = parseXPostUrl(xPostUrl);

  if (!postKey || postKey.length > 180 || !ACCOUNTS.has(account) || !post) return null;

  return { postKey, account, post };
}
