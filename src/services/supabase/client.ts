import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client singleton.
 *
 * USAGE: Import this in client components, hooks, and services.
 * For server-side (API routes, middleware), use `./server.ts` instead.
 */

const isLocalhost =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

const supabaseUrl = typeof window !== "undefined" && !isLocalhost
  ? window.location.origin
  : process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
  );
}

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
