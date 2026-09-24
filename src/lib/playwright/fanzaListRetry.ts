export type FanzaListRetryOptions = {
  attempts: number;
  backoffMs: readonly number[];
  pageNumber: number;
  url: string;
  load: () => Promise<void>;
  recover: (attempt: number, error: unknown) => Promise<void>;
  sleep?: (milliseconds: number) => Promise<void>;
  onFailure?: (details: string) => void;
};

function errorKind(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return /timeout/i.test(message) ? "timeout" : "error";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function loadFanzaListPageWithRetry({
  attempts,
  backoffMs,
  pageNumber,
  url,
  load,
  recover,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  onFailure = (details) => console.warn(details),
}: FanzaListRetryOptions): Promise<void> {
  if (attempts < 1) throw new Error("FANZA list retry attempts must be at least 1");

  const failures: string[] = [];

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await load();
      return;
    } catch (error) {
      const detail = `page=${pageNumber} attempt=${attempt}/${attempts} kind=${errorKind(error)} error=${errorMessage(error)}`;
      failures.push(detail);
      onFailure(`[fanza-list] ${detail} url=${url}`);

      if (attempt === attempts) break;

      await recover(attempt, error);
      const backoff = backoffMs[attempt - 1] ?? backoffMs.at(-1) ?? 0;
      if (backoff > 0) await sleep(backoff);
    }
  }

  throw new Error(
    `FANZA list page failed after ${attempts} attempts: page=${pageNumber} url=${url}; ${failures.join(" | ")}`,
  );
}
