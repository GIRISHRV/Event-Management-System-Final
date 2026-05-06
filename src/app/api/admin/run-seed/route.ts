import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import { Client } from "pg";
import { createServerSupabase } from "@/services/supabase/server";

function getSupabaseProjectRef(supabaseUrl: string) {
  try {
    const url = new URL(supabaseUrl);
    if (url.hostname.endsWith(".supabase.co")) {
      return url.hostname.replace(".supabase.co", "");
    }
  } catch {
    // Ignore malformed URLs and fall through to the local path.
  }

  return null;
}

async function runLocalSeed(sql: string) {
  const client = new Client({
    host: process.env.SUPABASE_DB_HOST ?? "127.0.0.1",
    port: Number(process.env.SUPABASE_DB_PORT ?? 54322),
    database: process.env.SUPABASE_DB_NAME ?? "postgres",
    user: process.env.SUPABASE_DB_USER ?? "postgres",
    password: process.env.SUPABASE_DB_PASSWORD ?? "postgres",
  });

  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

async function runHostedSeed(sql: string, projectRef: string) {
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("SUPABASE_ACCESS_TOKEN is required for hosted seeding");
  }

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query: sql }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message || `Seed failed with HTTP ${res.status}`);
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const sqlCandidates = [
      join(/*turbopackIgnore: true*/ process.cwd(), "supabase", "migrations", "seed_full_demo.sql"),
      join(/*turbopackIgnore: true*/ process.cwd(), "supabase", "seed_full_demo.sql"),
    ];

    let sql: string | null = null;
    let sqlPath: string | null = null;

    for (const candidate of sqlCandidates) {
      try {
        sql = readFileSync(candidate, "utf-8");
        sqlPath = candidate;
        break;
      } catch {
        // Try the next known seed location.
      }
    }

    if (!sql || !sqlPath) {
      throw new Error("Could not find seed_full_demo.sql in supabase/ or supabase/migrations/");
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured");
    }

    const projectRef = getSupabaseProjectRef(supabaseUrl);
    const isLocalSupabase = !projectRef || supabaseUrl.includes("127.0.0.1") || supabaseUrl.includes("localhost");

    if (isLocalSupabase) {
      await runLocalSeed(sql);
    } else {
      await runHostedSeed(sql, projectRef);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
