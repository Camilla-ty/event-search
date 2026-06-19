/**
 * Phase 2A.1 — anon/public keyword read preflight.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/verify-keyword-public-read.ts
 */
import { createClient } from "@supabase/supabase-js";

type CheckResult = {
  label: string;
  ok: boolean;
  error?: string;
  count?: number;
  sample?: unknown;
};

function readEnv(name: string): string {
  const value = process.env[name]?.trim() ?? "";
  if (value === "") {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

async function runCheck(
  label: string,
  fn: () => Promise<Omit<CheckResult, "label">>,
): Promise<CheckResult> {
  const result = await fn();
  return { label, ...result };
}

async function main(): Promise<void> {
  const url = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const checks: CheckResult[] = [];

  checks.push(
    await runCheck("keyword_direct_select", async () => {
      const { data, error } = await supabase
        .from("keyword")
        .select("id, name, slug")
        .limit(5);
      if (error) {
        return { ok: false, error: `${error.code ?? "error"}: ${error.message}` };
      }
      return { ok: true, count: data.length, sample: data[0] ?? null };
    }),
  );

  checks.push(
    await runCheck("event_series_keyword_direct_select", async () => {
      const { data, error } = await supabase
        .from("event_series_keyword")
        .select("series_id, keyword_id")
        .limit(5);
      if (error) {
        return { ok: false, error: `${error.code ?? "error"}: ${error.message}` };
      }
      return { ok: true, count: data.length, sample: data[0] ?? null };
    }),
  );

  checks.push(
    await runCheck("event_series_keyword_join_keyword", async () => {
      const { data, error } = await supabase
        .from("event_series_keyword")
        .select("series_id, keyword_id, keyword ( id, name, slug )")
        .limit(5);
      if (error) {
        return { ok: false, error: `${error.code ?? "error"}: ${error.message}` };
      }
      return { ok: true, count: data.length, sample: data[0] ?? null };
    }),
  );

  checks.push(
    await runCheck("event_series_keyword_join_by_series", async () => {
      const { data: links, error: linkError } = await supabase
        .from("event_series_keyword")
        .select("series_id")
        .limit(1);
      if (linkError) {
        return {
          ok: false,
          error: `${linkError.code ?? "error"}: ${linkError.message}`,
        };
      }

      const seriesId = links[0]?.series_id;
      if (typeof seriesId !== "string" || seriesId.trim() === "") {
        return {
          ok: true,
          count: 0,
          sample: null,
          error: "no event_series_keyword rows to test series filter",
        };
      }

      const { data, error } = await supabase
        .from("event_series_keyword")
        .select("keyword_id, keyword ( id, name, slug )")
        .eq("series_id", seriesId);
      if (error) {
        return { ok: false, error: `${error.code ?? "error"}: ${error.message}` };
      }
      return { ok: true, count: data.length, sample: data[0] ?? null };
    }),
  );

  for (const check of checks) {
    console.log(JSON.stringify(check));
  }

  const failed = checks.filter((check) => !check.ok);
  if (failed.length > 0) {
    console.error(`\nFAILED ${failed.length}/${checks.length} checks`);
    process.exit(1);
  }

  console.log(`\nPASSED ${checks.length}/${checks.length} anon keyword read checks`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
