import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://euubswbzxwzgywqqtunn.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1dWJzd2J6eHd6Z3l3cXF0dW5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNzMzMjQsImV4cCI6MjA5Nzg0OTMyNH0.DTSKu7dPgXQuianztIpTO14-OZU325jVgs8M7r7Ii5o";

// Logged fetch wrapper — prints every Supabase request + non-2xx errors to the console.
const loggedFetch: typeof fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const method = init?.method ?? (typeof input === "object" && "method" in input ? (input as Request).method : "GET");
  const short = url.replace(SUPABASE_URL, "");
  const start = performance.now();
  console.log(`[supabase] → ${method} ${short}`);
  try {
    const res = await fetch(input, init);
    const ms = Math.round(performance.now() - start);
    if (!res.ok) {
      const clone = res.clone();
      let body = "";
      try { body = await clone.text(); } catch { /* ignore */ }
      console.error(`[supabase] ✗ ${method} ${short} → ${res.status} (${ms}ms)`, body);
    } else {
      console.log(`[supabase] ✓ ${method} ${short} → ${res.status} (${ms}ms)`);
    }
    return res;
  } catch (err) {
    console.error(`[supabase] ✗ ${method} ${short} → network error`, err);
    throw err;
  }
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
  global: { fetch: loggedFetch },
});

if (typeof window !== "undefined") {
  console.log("[supabase] client initialized", { url: SUPABASE_URL, keyPrefix: SUPABASE_PUBLISHABLE_KEY.slice(0, 12) + "…" });
}