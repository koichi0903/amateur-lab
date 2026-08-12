import { run0030 } from "@/lib/cron/run0030";
import { run1030 } from "@/lib/cron/run1030";
import { runSemiNew } from "@/lib/cron/runSemiNew";
import { NextResponse } from "next/server";
import { UPDATE_CONFIG } from "@/config/update";

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

  const jobs: string[] = [];

  if (time === UPDATE_CONFIG.CRON.NIGHT) {
  jobs.push("NIGHT");

  await run0030();
}

if (time === UPDATE_CONFIG.CRON.DAY) {
  jobs.push("DAY");

  await run1030();
}

  if (
  UPDATE_CONFIG.CRON.SEMI_NEW.days.includes(day) &&
  time === UPDATE_CONFIG.CRON.SEMI_NEW.time
) {
  jobs.push("SEMI_NEW");

  await runSemiNew();
}


  return NextResponse.json({
  now: time,
  day,
  jobs,
});
}
