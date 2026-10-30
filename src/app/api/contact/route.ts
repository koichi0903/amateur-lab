import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { validateContactPayload, type ContactPayload } from "@/lib/contactPayload";

export const runtime = "nodejs";
export const maxDuration = 10;

const rateLimitWindowMs = 10 * 60 * 1000;
const rateLimitMax = 3;
const submissions = new Map<string, number[]>();

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

  const validation = validateContactPayload(payload, Date.now);
  if (validation.kind === "honeypot") return NextResponse.json({ message: "送信を受け付けました。" });
  if (validation.kind === "invalid") return NextResponse.json({ message: validation.message }, { status: 400 });
  const { category, name, replyEmail, targetUrl, details } = validation.payload;
  const { now } = validation;

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
