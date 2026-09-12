import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { trimVideoForX, probeVideoFile } from "../src/lib/xVideoTrim.ts";
import { mkdir, copyFile, rm } from "node:fs/promises";
import { join } from "node:path";

const assetId = Number(process.argv[2] ?? 8345);
const trimStartSeconds = Number(process.argv[3] ?? 5.3);
const outDir = join(process.cwd(), "work", "trim-smoke");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase environment is missing.");

const supabase = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await supabase
  .from("x_media_assets")
  .select("id,work_id,source_url,can_modify,trim_modify_confirmed,media_quality,manual_tags")
  .eq("account_handle", "hakkutsu_lab")
  .eq("id", assetId)
  .single();
if (error || !data) throw new Error(error?.message ?? "Asset not found.");

await mkdir(outDir, { recursive: true });
const result = await trimVideoForX({ sourceUrl: data.source_url, trimStartSeconds });
const output = join(outDir, `asset-${assetId}-trim-${result.trimStartSeconds.toFixed(1)}.mp4`);
await copyFile(result.file, output);
const probe = await probeVideoFile(output);
await rm(result.dir, { recursive: true, force: true });
console.log(JSON.stringify({
  assetId,
  workId: data.work_id,
  requestedTrimStartSeconds: trimStartSeconds,
  actualTrimStartSeconds: result.trimStartSeconds,
  sourceDurationSeconds: result.durationSeconds,
  outputDurationSeconds: result.outputDurationSeconds,
  outputCodec: probe.codec,
  outputAudioCodec: probe.audioCodec,
  output,
  canModify: data.can_modify,
  trimModifyConfirmed: data.trim_modify_confirmed,
}, null, 2));
