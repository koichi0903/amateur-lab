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

  // Hobby cron invocations may occur at any point within the scheduled hour.
  // The endpoint itself is scheduled once per day, so always run the daily job.
  await run0030();

  return NextResponse.json({
    now: time,
    day,
    jobs: ["DAILY"],
  });
}
