import { NextResponse } from "next/server";
import { UPDATE_CONFIG } from "@/config/update";
import { run0030 } from "@/lib/cron/run0030";
import { run0300 } from "@/lib/cron/run0300";
import { run0330 } from "@/lib/cron/run0330";
import { runSunday1200 } from "@/lib/cron/runSunday1200";
import { runSunday1400 } from "@/lib/cron/runSunday1400";

export async function GET() {
  const now = new Date();

  const time =
    now.toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

  const day =
    now.toLocaleDateString("en-US", {
      weekday: "long",
    }).toLowerCase();

  const jobs: string[] = [];

  if (
  UPDATE_CONFIG.CRON.SALE.includes(time)
) {
  jobs.push("00:30");

  await run0030();
}

  if (
  time === UPDATE_CONFIG.CRON.RESERVE
) {
  jobs.push("03:00");

  await run0300();
}

  if (
  time === UPDATE_CONFIG.CRON.NEW
) {
  jobs.push("03:30");

  await run0330();
}

  if (
  day === UPDATE_CONFIG.CRON.OLD.day &&
  time === UPDATE_CONFIG.CRON.OLD.time
) {
  jobs.push("Sunday12:00");

  await runSunday1200();
}

  if (
  day === UPDATE_CONFIG.CRON.SEMI_NEW.day &&
  time === UPDATE_CONFIG.CRON.SEMI_NEW.time
) {
  jobs.push("Sunday14:00");

  await runSunday1400();
}


  return NextResponse.json({
  now: time,
  day,
  jobs,
});
}