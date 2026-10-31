import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { validateContactPayload, type ContactPayload } from "@/lib/contactPayload";
import { buildContactEmailText, validateContactRequest } from "@/lib/contactRequestPolicy";

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

  const origin = request.headers.get("origin");
  const contentLength = Number(request.headers.get("content-length") || 0);
  const rejection = validateContactRequest({
    contactEmail,
    from,
    apiKey,
    origin,
    requestHost: request.nextUrl.host,
    contentLength,
  });
  if (rejection) {
    return NextResponse.json({ message: rejection.message }, { status: rejection.status });
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
  const text = buildContactEmailText({ referenceId, category, name, replyEmail, targetUrl, details });

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
