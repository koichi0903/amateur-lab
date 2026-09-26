export const MYFANS_ACCOUNTS = ["lumi_reviw", "fansmy230"] as const;
export type MyfansAccountKey = typeof MYFANS_ACCOUNTS[number];

export function normalizeMyfansAccountKey(value: string) {
  return value.trim().replace(/^@/, "").toLowerCase();
}

export function accountScopedIdempotencyKey(accountId: number | null | undefined, key: string) {
  return `${accountId ?? "shared"}:${key}`;
}

export function isAccountVisible(rowAccountId: number | null | undefined, selectedAccountId: number | null | undefined) {
  return selectedAccountId == null || rowAccountId == null || rowAccountId === selectedAccountId;
}

export function accountScopedExclusionKey(accountId: number | null | undefined, entityType: string, entityKey: string) {
  return `${accountId ?? "shared"}:${entityType}:${entityKey}`;
}
