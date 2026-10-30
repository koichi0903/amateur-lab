export type ContactPayload = {
  category?: unknown;
  name?: unknown;
  replyEmail?: unknown;
  targetUrl?: unknown;
  details?: unknown;
  consent?: unknown;
  website?: unknown;
  startedAt?: unknown;
};

type ValidContactPayload = {
  category: string;
  name: string;
  replyEmail: string;
  targetUrl: string;
  details: string;
};

export type ContactPayloadValidation =
  | { kind: "honeypot" }
  | { kind: "invalid"; message: string }
  | { kind: "valid"; payload: ValidContactPayload; now: number };

const categories = new Set([
  "掲載情報の訂正",
  "権利に関する連絡",
  "プライバシー",
  "サイトの不具合",
  "その他",
]);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function optionalString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function validOptionalUrl(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateContactPayload(payload: ContactPayload, getNow: () => number): ContactPayloadValidation {
  const category = optionalString(payload.category);
  const name = optionalString(payload.name);
  const replyEmail = optionalString(payload.replyEmail);
  const targetUrl = optionalString(payload.targetUrl);
  const details = optionalString(payload.details);
  const website = optionalString(payload.website);
  const startedAt = typeof payload.startedAt === "number" ? payload.startedAt : 0;
  const now = getNow();

  if (website) return { kind: "honeypot" };
  if (!categories.has(category)) return { kind: "invalid", message: "お問い合わせ種別を確認してください。" };
  if (name.length > 80) return { kind: "invalid", message: "お名前が長すぎます。" };
  if (!emailPattern.test(replyEmail) || replyEmail.length > 254) {
    return { kind: "invalid", message: "返信先メールアドレスを確認してください。" };
  }
  if (targetUrl.length > 1000 || !validOptionalUrl(targetUrl)) {
    return { kind: "invalid", message: "対象ページURLを確認してください。" };
  }
  if (details.length < 20 || details.length > 5000) {
    return { kind: "invalid", message: "お問い合わせ内容は20〜5000文字で入力してください。" };
  }
  if (payload.consent !== true) return { kind: "invalid", message: "個人情報の取り扱いへの同意が必要です。" };
  if (!startedAt || now - startedAt < 2_000 || now - startedAt > 2 * 60 * 60 * 1000) {
    return { kind: "invalid", message: "ページを再読み込みして、もう一度お試しください。" };
  }

  return { kind: "valid", payload: { category, name, replyEmail, targetUrl, details }, now };
}
