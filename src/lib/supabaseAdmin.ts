import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_FETCH_ATTEMPTS = 3;

function getErrorCode(error: unknown): string | undefined {
  let current = error;

  for (let depth = 0; depth < 4; depth++) {
    if (typeof current !== "object" || current === null) return undefined;

    const candidate = current as { code?: unknown; cause?: unknown };
    if (typeof candidate.code === "string") return candidate.code;
    current = candidate.cause;
  }

  return undefined;
}

const fetchWithConnectRetry: typeof fetch = async (input, init) => {
  for (let attempt = 1; attempt <= SUPABASE_FETCH_ATTEMPTS; attempt++) {
    try {
      const requestInput = input instanceof Request ? input.clone() : input;
      return await fetch(requestInput, init);
    } catch (error) {
      const errorCode = getErrorCode(error);
      const shouldRetry =
        errorCode === "UND_ERR_CONNECT_TIMEOUT" &&
        attempt < SUPABASE_FETCH_ATTEMPTS;

      if (!shouldRetry) throw error;

      const delayMs = attempt * 1_000;
      console.warn(
        `[supabase] connection timed out; retrying in ${delayMs}ms (${attempt}/${SUPABASE_FETCH_ATTEMPTS})`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error("Supabase request exhausted all connection attempts");
};

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Server database access requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
  );
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    fetch: fetchWithConnectRetry,
  },
});
