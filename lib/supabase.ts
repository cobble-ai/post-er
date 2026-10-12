import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Untyped on purpose: the schema is three small tables, typed at the edges in lib/types.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let client: SupabaseClient<any> | null = null;

export function db() {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client = createClient<any>(url, key, { auth: { persistSession: false } });
  }
  return client;
}
