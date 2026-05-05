import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const tunnelUrl = process.env.SUPABASE_TUNNEL_URL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const result: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      SUPABASE_TUNNEL_URL: tunnelUrl ? `${tunnelUrl.slice(0, 40)}...` : "NOT SET",
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl ?? "NOT SET",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey ? "SET" : "NOT SET",
    },
    tunnel: { status: "unchecked" },
    proxy: { status: "unchecked" },
  };

  // 1. Check tunnel directly (server-side, no CORS)
  if (tunnelUrl && anonKey) {
    try {
      const res = await fetch(`${tunnelUrl}/rest/v1/`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
        signal: AbortSignal.timeout(8000),
      });
      result.tunnel = {
        status: res.ok ? "✅ connected" : `❌ HTTP ${res.status}`,
        httpStatus: res.status,
      };
    } catch (e) {
      result.tunnel = { status: "❌ unreachable", error: String(e) };
    }
  } else {
    result.tunnel = { status: "⚠️ SUPABASE_TUNNEL_URL not set" };
  }

  // 2. Check proxy path (vercel → tunnel rewrite)
  if (supabaseUrl && anonKey) {
    try {
      const proxyBase = supabaseUrl.endsWith("/supabase-proxy")
        ? supabaseUrl
        : `${supabaseUrl}/supabase-proxy`;
      const res = await fetch(`${proxyBase}/rest/v1/`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
        signal: AbortSignal.timeout(8000),
      });
      result.proxy = {
        status: res.ok ? "✅ connected" : `❌ HTTP ${res.status}`,
        httpStatus: res.status,
        url: `${proxyBase}/rest/v1/`,
      };
    } catch (e) {
      result.proxy = { status: "❌ unreachable", error: String(e) };
    }
  } else {
    result.proxy = { status: "⚠️ NEXT_PUBLIC_SUPABASE_URL not set" };
  }

  const allGood =
    String(result.tunnel.status).startsWith("✅") &&
    (String(result.proxy.status).startsWith("✅") ||
      String(result.proxy.status).startsWith("⚠️"));

  return NextResponse.json(result, { status: allGood ? 200 : 503 });
}
