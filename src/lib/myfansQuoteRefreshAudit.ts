import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function auditContinuation(
  jobId: number,
  action: string,
  summary: string,
  metadata: Record<string, unknown> = {},
) {
  const { error } = await supabaseAdmin.from("myfans_audit_logs").insert({
    entity_type: "quote_refresh_job",
    entity_id: jobId,
    action,
    summary,
    metadata: { source: "myfans_companion_batch", ...metadata },
  });
  if (!error) return { persisted: true, compatibilityFallback: false };

  // Older production schemas still restrict entity_type to the original audit values.
  // Do not let an audit-only incompatibility stop the collection state machine.
  if (/check constraint|violates check constraint/i.test(error.message)) {
    const fallback = await supabaseAdmin.from("myfans_audit_logs").insert({
      entity_type: "import",
      entity_id: jobId,
      action: `QUOTE_REFRESH_${action}`,
      summary,
      metadata: {
        source: "myfans_companion_batch",
        compatibility_fallback: true,
        original_entity_type: "quote_refresh_job",
        ...metadata,
      },
    });
    if (!fallback.error) return { persisted: true, compatibilityFallback: true };
  }
  throw new Error(`myfans quote refresh continuation audit failed: ${error.message}`);
}

export async function auditStaleJobFinalized(
  jobId: number,
  metadata: Record<string, unknown>,
) {
  const existing = await supabaseAdmin
    .from("myfans_audit_logs")
    .select("id")
    .eq("entity_type", "quote_refresh_job")
    .eq("entity_id", jobId)
    .eq("action", "STALE_JOB_FINALIZED")
    .limit(1)
    .maybeSingle();
  if (existing.error) throw new Error(`stale job audit lookup failed: ${existing.error.message}`);
  if (existing.data) return;

  const { error } = await supabaseAdmin.from("myfans_audit_logs").insert({
    entity_type: "quote_refresh_job",
    entity_id: jobId,
    action: "STALE_JOB_FINALIZED",
    summary: "stale jobをexecution lifecycleのみterminalizeしました。",
    metadata: { source: "myfans_companion_batch", ...metadata },
  });
  if (!error) return;

  // A concurrent cleanup may have won the unique audit insert. Treat that as idempotent success;
  // every other persistence failure must remain visible to the caller.
  if (/duplicate key|unique constraint/i.test(error.message)) {
    const retry = await supabaseAdmin
      .from("myfans_audit_logs")
      .select("id")
      .eq("entity_type", "quote_refresh_job")
      .eq("entity_id", jobId)
      .eq("action", "STALE_JOB_FINALIZED")
      .limit(1)
      .maybeSingle();
    if (!retry.error && retry.data) return;
    if (retry.error) throw new Error(`stale job audit confirmation failed: ${retry.error.message}`);
  }
  throw new Error(`stale job audit persistence failed: ${error.message}`);
}
