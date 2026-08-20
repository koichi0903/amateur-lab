import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });

const args = Object.fromEntries(
  process.argv.slice(2).map((value) => {
    const separator = value.indexOf("=");
    return separator === -1
      ? [value.replace(/^--/, ""), ""]
      : [value.slice(0, separator).replace(/^--/, ""), value.slice(separator + 1)];
  }),
);

const runId = args["run-id"];
const scheduleGroup = args.group;
const status = args.status;
const errorMessage = args.error?.slice(0, 4000) || null;
const logFile = args["log-file"] || null;
const allowedGroups = new Set([
  "daily-0030",
  "daily-1030",
  "tue-fri-1800",
  "sunday-1800",
]);
const allowedStatuses = new Set(["running", "completed", "failed", "skipped"]);

if (!runId || !allowedGroups.has(scheduleGroup) || !allowedStatuses.has(status)) {
  console.error("[schedule-monitor] invalid arguments");
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("[schedule-monitor] Supabase environment variables are missing");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const now = new Date().toISOString();
const payload = {
  run_id: runId,
  schedule_group: scheduleGroup,
  status,
  log_file: logFile,
  error_message: errorMessage,
  ...(status === "running" ? { started_at: now, finished_at: null } : { finished_at: now }),
};
const { error } = await supabase
  .from("scheduled_update_runs")
  .upsert(payload, { onConflict: "run_id" });

if (error) {
  console.error(`[schedule-monitor] failed to save status: ${error.message}`);
  process.exit(1);
}

if (status === "failed") {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.CONTACT_FROM_EMAIL?.trim();
  const to = process.env.CONTACT_EMAIL?.trim();

  if (!apiKey || !from || !to) {
    console.warn("[schedule-monitor] failure saved, but Resend settings are missing locally");
  } else {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `scheduled-update-${runId}`,
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject: `【発掘LAB】自動更新失敗: ${scheduleGroup}`,
          text: [
            "発掘LABの自動更新が失敗しました。",
            `スケジュール: ${scheduleGroup}`,
            `発生時刻: ${now}`,
            `ログ: ${logFile ?? "不明"}`,
            `エラー: ${errorMessage ?? "詳細なし"}`,
          ].join("\n"),
        }),
      });

      if (!response.ok) {
        console.warn(`[schedule-monitor] Resend returned ${response.status}`);
      }
    } catch (notificationError) {
      console.warn("[schedule-monitor] failure email could not be sent", notificationError);
    }
  }
}

console.log(`[schedule-monitor] ${scheduleGroup}: ${status}`);
