type XPostLogSchemaError = {
  code?: string;
  message?: string;
} | null;

type XPostLogFallbackRow = {
  post_key: string;
  work_id: number;
  category: string;
  title: string;
  post_text: string;
  post_date: string;
  posted_at: string;
};

const LEGACY_COLUMN_NAMES = [
  "creative_variant_id",
  "account_handle",
  "post_intent",
  "x_post_id",
] as const;

function isLegacyXPostLogSchemaError(error: XPostLogSchemaError) {
  if (!error) return false;
  return error.code === "PGRST204" || LEGACY_COLUMN_NAMES.some((column) => error.message?.includes(column));
}

export function buildLegacyXPostLogFallback(
  error: XPostLogSchemaError,
  xPostId: string | null | undefined,
  row: XPostLogFallbackRow,
): XPostLogFallbackRow | null {
  if (!isLegacyXPostLogSchemaError(error) || xPostId) return null;
  return {
    post_key: row.post_key,
    work_id: row.work_id,
    category: row.category,
    title: row.title,
    post_text: row.post_text,
    post_date: row.post_date,
    posted_at: row.posted_at,
  };
}
