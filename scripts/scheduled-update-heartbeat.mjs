import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });

const runId = process.env.SCHEDULE_RUN_ID;
const parentPid = Number(process.env.SCHEDULE_PARENT_PID);
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!runId || !supabaseUrl || !serviceRoleKey) process.exit(0);

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function heartbeat() {
  const { error } = await supabase
    .from("scheduled_update_runs")
    .update({ heartbeat_at: new Date().toISOString() })
    .eq("run_id", runId)
    .eq("status", "running");
  if (error) console.warn(`[schedule-heartbeat] ${error.message}`);
}

function parentStillExists() {
  if (!Number.isInteger(parentPid) || parentPid <= 0) return true;
  try {
    process.kill(parentPid, 0);
    return true;
  } catch {
    return false;
  }
}

await heartbeat();
const heartbeatTimer = setInterval(() => {
  if (!parentStillExists()) {
    clearInterval(heartbeatTimer);
    process.exit(0);
  }
  void heartbeat();
}, 60_000);

process.on("SIGTERM", () => {
  clearInterval(heartbeatTimer);
  process.exit(0);
});
