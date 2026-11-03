export type ContactRequestRejection = {
  message: string;
  status: 403 | 413 | 503;
};

export function validateContactRequest({
  contactEmail,
  from,
  apiKey,
  origin,
  requestHost,
  contentLength,
}: {
  contactEmail: string | undefined;
  from: string | undefined;
  apiKey: string | undefined;
  origin: string | null;
  requestHost: string;
  contentLength: number;
}): ContactRequestRejection | null {
  if (!contactEmail || !from || !apiKey) {
    return { message: "お問い合わせ窓口は現在準備中です。", status: 503 };
  }

  if (origin) {
    try {
      if (new URL(origin).host !== requestHost) {
        return { message: "このサイトから送信してください。", status: 403 };
      }
    } catch {
      return { message: "不正な送信元です。", status: 403 };
    }
  }

  if (contentLength > 20_000) {
    return { message: "入力内容が長すぎます。", status: 413 };
  }

  return null;
}

export function buildContactEmailText({
  referenceId,
  category,
  name,
  replyEmail,
  targetUrl,
  details,
}: {
  referenceId: string;
  category: string;
  name: string;
  replyEmail: string;
  targetUrl: string;
  details: string;
}) {
  return [
    "発掘LAB お問い合わせ",
    `受付ID: ${referenceId}`,
    `種別: ${category}`,
    `お名前: ${name || "未入力"}`,
    `返信先: ${replyEmail}`,
    `対象URL: ${targetUrl || "未入力"}`,
    "",
    "お問い合わせ内容:",
    details,
  ].join("\n");
}
