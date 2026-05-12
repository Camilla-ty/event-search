import { NextResponse } from "next/server";

import { createClient } from "@/src/lib/supabase/server";

function normalizeBaseUrl(url: string) {
  return url
    .replace(/\/?rest\/v1\/?$/, "")
    .replace(/\/?auth\/v1\/?.*$/, "")
    .replace(/\/+$/, "");
}

export async function GET() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const table = process.env.SUPABASE_HEALTH_TABLE;

  if (!rawUrl || !anonKey) {
    return NextResponse.json(
      { ok: false, error: "Missing Supabase URL or anon key env vars." },
      { status: 500 },
    );
  }

  const baseUrl = normalizeBaseUrl(rawUrl);
  const ping = await fetch(`${baseUrl}/auth/v1/health`, {
    headers: { apikey: anonKey },
    cache: "no-store",
  });

  const supabase = await createClient();
  const { error: sessionError } = await supabase.auth.getSession();

  const payload: {
    ok: boolean;
    goTrue: { ok: boolean; status: number };
    authSdk: { ok: boolean; error?: string };
    table?: {
      name: string;
      ok: boolean;
      error?: string;
      rowSample?: unknown;
    };
  } = {
    ok: ping.ok && !sessionError,
    goTrue: { ok: ping.ok, status: ping.status },
    authSdk: sessionError
      ? { ok: false, error: sessionError.message }
      : { ok: true },
  };

  if (table) {
    const { data: rows, error: tableError } = await supabase
      .from(table)
      .select("*")
      .limit(1);

    payload.table = {
      name: table,
      ok: !tableError,
      error: tableError?.message,
      rowSample: rows?.[0] ?? null,
    };
    payload.ok = payload.ok && payload.table.ok;
  }

  return NextResponse.json(payload, { status: payload.ok ? 200 : 502 });
}
