import { createHash } from "node:crypto";
import { supabaseAdmin } from "../supabaseAdmin";
export { intValue, nullableId, numberValue, text } from "../formDataValues";
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

export function rowKey(...parts: string[]) {
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

export async function audit(entityType: string, entityId: number | null, action: string, summary: string, metadata = {}) {
  await supabaseAdmin.from("myfans_audit_logs").insert({
    entity_type: entityType,
    entity_id: entityId,
    action,
    summary,
    metadata,
  });
}
