import { run0030 } from "@/lib/cron/run0030";
import { NextResponse } from "next/server";

export const maxDuration = 300;

export async function GET() {
  const now = new Date();

  const time =
    now.toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Tokyo",
    });

  const day =
    now.toLocaleDateString("en-US", {
      weekday: "long",
      timeZone: "Asia/Tokyo",
    }).toLowerCase();

  if (process.env.VERCEL && process.env.ENABLE_VERCEL_CRON_UPDATES !== "true") {
    return NextResponse.json({
      now: time,
      day,
      skipped: true,
      reason:
        "Vercel cron updates are disabled. Run the update jobs from the local scheduler or set ENABLE_VERCEL_CRON_UPDATES=true.",
    });
  }

  await run0030();

  return NextResponse.json({
    now: time,
    day,
    jobs: ["DAILY"],
  });
}
