import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

const GROUPS = ["daily-0030", "daily-1030", "tue-fri-1800", "sunday-1800"] as const;

type ScheduleRun = {
  run_id: string;
  schedule_group: (typeof GROUPS)[number];
  status: "running" | "completed" | "failed" | "skipped";
  started_at: string;
  finished_at: string | null;
  error_message: string | null;
  log_file: string | null;
};

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("scheduled_update_runs")
    .select("run_id,schedule_group,status,started_at,finished_at,error_message,log_file")
    .order("started_at", { ascending: false })
    .limit(100);

  if (error) {
    // The update page must remain usable before the migration is applied.
    if (error.code === "42P01" || error.code === "PGRST205") {
      return NextResponse.json({ schedules: [], unavailable: true });
    }
    console.error("Failed to load scheduled update runs", error);
    return NextResponse.json({ error: "Failed to load scheduled update runs" }, { status: 500 });
  }

  const runs = (data ?? []) as ScheduleRun[];
  const schedules = GROUPS.map((group) => {
    const groupRuns = runs.filter((run) => run.schedule_group === group);
    return {
      group,
      latest: groupRuns[0] ?? null,
      lastSuccess: groupRuns.find((run) => run.status === "completed") ?? null,
      lastFailure: groupRuns.find((run) => run.status === "failed") ?? null,
    };
  });

  return NextResponse.json({ schedules, unavailable: false });
}
