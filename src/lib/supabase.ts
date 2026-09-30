import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

function getSupabaseClient() {
  if (client) return client;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Public database access requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  client = createClient(supabaseUrl, supabaseAnonKey);
  return client;
}

// Keep the existing object-style API while deferring env validation until a
// request actually uses the client. This prevents route import during build
// from requiring runtime database credentials.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, property) {
    const supabaseClient = getSupabaseClient();
    const value = Reflect.get(supabaseClient, property, supabaseClient);
    return typeof value === "function" ? value.bind(supabaseClient) : value;
  },
});
