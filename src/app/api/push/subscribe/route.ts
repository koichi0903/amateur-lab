import { NextResponse } from "next/server";
import {
  type PushSubscriptionBody,
  validatePushSubscriptionPayload,
} from "@/lib/pushSubscriptionPayload";
import { saveAmateurSubscription, saveWorkSubscription } from "./persist";

const PUSH_SAVE_TIMEOUT_MS = 15_000;

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) return NextResponse.json({ error: "Push通知はまだ設定されていません" }, { status: 503 });
  return NextResponse.json({ publicKey });
}

async function saveSubscription(request: Request) {
  let body: PushSubscriptionBody;
  try {
    body = (await request.json()) as PushSubscriptionBody;
  } catch {
    return badRequest("通知設定の形式が正しくありません");
  }

  const validation = validatePushSubscriptionPayload(body);
  if (!validation.ok) return badRequest(validation.message);
  if (validation.value.kind === "amateur") return saveAmateurSubscription(validation.value, request);
  return saveWorkSubscription(validation.value, request);
}

export async function POST(request: Request) {
  try {
    return await Promise.race([
      saveSubscription(request),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("通知設定の保存がタイムアウトしました")), PUSH_SAVE_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    console.error("[push] subscribe request failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "通知設定を保存できませんでした" },
      { status: 504 },
    );
  }
}
