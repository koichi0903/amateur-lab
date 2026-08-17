import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 10;

const categories = new Set([
  "掲載情報の訂正",
  "権利に関する連絡",
  "プライバシー",
  "サイトの不具合",
  "その他",
]);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const rateLimitWindowMs = 10 * 60 * 1000;
const rateLimitMax = 3;
const submissions = new Map<string, number[]>();

type ContactPayload = {
  category?: unknown;
  name?: unknown;
  replyEmail?: unknown;
  targetUrl?: unknown;
  details?: unknown;
  consent?: unknown;
  website?: unknown;
  startedAt?: unknown;
};

function getClientKey(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const value = forwarded || request.headers.get("x-real-ip") || "unknown";
  return createHash("sha256").update(value).digest("hex");
}

function isRateLimited(key: string, now: number) {
  for (const [storedKey, timestamps] of submissions) {
    const active = timestamps.filter((timestamp) => now - timestamp < rateLimitWindowMs);
    if (active.length === 0) submissions.delete(storedKey);
    else if (active.length !== timestamps.length) submissions.set(storedKey, active);
  }

  const active = submissions.get(key) ?? [];
  return active.length >= rateLimitMax;
}

function recordSubmission(key: string, now: number) {
  submissions.set(key, [...(submissions.get(key) ?? []), now]);
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

export async function POST(request: NextRequest) {
  const contactEmail = process.env.CONTACT_EMAIL?.trim();
  const from = process.env.CONTACT_FROM_EMAIL?.trim();
  const apiKey = process.env.RESEND_API_KEY?.trim();

  if (!contactEmail || !from || !apiKey) {
    return NextResponse.json({ message: "お問い合わせ窓口は現在準備中です。" }, { status: 503 });
  }

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== request.nextUrl.host) {
        return NextResponse.json({ message: "このサイトから送信してください。" }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ message: "不正な送信元です。" }, { status: 403 });
    }
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 20_000) {
    return NextResponse.json({ message: "入力内容が長すぎます。" }, { status: 413 });
  }

  let payload: ContactPayload;
  try {
    payload = (await request.json()) as ContactPayload;
  } catch {
    return NextResponse.json({ message: "入力内容を確認してください。" }, { status: 400 });
  }

  const category = typeof payload.category === "string" ? payload.category.trim() : "";
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const replyEmail = typeof payload.replyEmail === "string" ? payload.replyEmail.trim() : "";
  const targetUrl = typeof payload.targetUrl === "string" ? payload.targetUrl.trim() : "";
  const details = typeof payload.details === "string" ? payload.details.trim() : "";
  const website = typeof payload.website === "string" ? payload.website.trim() : "";
  const startedAt = typeof payload.startedAt === "number" ? payload.startedAt : 0;
  const now = Date.now();

  if (website) return NextResponse.json({ message: "送信を受け付けました。" });
  if (!categories.has(category)) return NextResponse.json({ message: "お問い合わせ種別を確認してください。" }, { status: 400 });
  if (name.length > 80) return NextResponse.json({ message: "お名前が長すぎます。" }, { status: 400 });
  if (!emailPattern.test(replyEmail) || replyEmail.length > 254) {
    return NextResponse.json({ message: "返信先メールアドレスを確認してください。" }, { status: 400 });
  }
  if (targetUrl.length > 1000 || !validOptionalUrl(targetUrl)) {
    return NextResponse.json({ message: "対象ページURLを確認してください。" }, { status: 400 });
  }
  if (details.length < 20 || details.length > 5000) {
    return NextResponse.json({ message: "お問い合わせ内容は20〜5000文字で入力してください。" }, { status: 400 });
  }
  if (payload.consent !== true) return NextResponse.json({ message: "個人情報の取り扱いへの同意が必要です。" }, { status: 400 });
  if (!startedAt || now - startedAt < 2_000 || now - startedAt > 2 * 60 * 60 * 1000) {
    return NextResponse.json({ message: "ページを再読み込みして、もう一度お試しください。" }, { status: 400 });
  }

  const clientKey = getClientKey(request);
  if (isRateLimited(clientKey, now)) {
    return NextResponse.json({ message: "短時間に送信できる回数を超えました。10分ほど待ってお試しください。" }, { status: 429 });
  }

  const referenceId = randomUUID();
  const text = [
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

  try {
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `contact-${referenceId}`,
      },
      body: JSON.stringify({
        from,
        to: [contactEmail],
        reply_to: replyEmail,
        subject: `【発掘LAB】${category}`,
        text,
      }),
      cache: "no-store",
    });

    if (!resendResponse.ok) {
      const errorBody = await resendResponse.text();
      console.error("contact email failed", { status: resendResponse.status, body: errorBody.slice(0, 500) });
      return NextResponse.json({ message: "送信できませんでした。時間をおいて再度お試しください。" }, { status: 502 });
    }

    recordSubmission(clientKey, now);
    return NextResponse.json({ message: "お問い合わせを受け付けました。" });
  } catch (error) {
    console.error("contact email request failed", error);
    return NextResponse.json({ message: "送信できませんでした。時間をおいて再度お試しください。" }, { status: 502 });
  }
}
