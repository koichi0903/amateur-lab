import { NextRequest, NextResponse } from "next/server";
import { JOBS, stopJob, type JobName } from "@/lib/jobs";

const jobNames = new Set<string>(Object.values(JOBS));

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    jobName?: string;
  };

  if (body.jobName !== "all" && !jobNames.has(body.jobName ?? "")) {
    return NextResponse.json(
      { success: false, message: "停止対象が正しくありません。" },
      { status: 400 },
    );
  }

  const stopped = await stopJob(
    body.jobName === "all" ? undefined : (body.jobName as JobName),
  );

  return NextResponse.json({
    success: true,
    stopped: stopped.map((job) => job.job_name),
    message: stopped.length
      ? "停止を受け付けました。現在の処理単位が終わり次第停止します。"
      : "実行中の更新はありません。",
  });
}
