import type { SupabaseClient } from "@supabase/supabase-js";
import { readBackfillEnv } from "./env";

export type BackfillRow = {
  id: string;
  [key: string]: unknown;
};

export type BackfillSkip = {
  reason: string;
  message: string;
};

export type BackfillResolvedValue = {
  column?: string;
  value?: string;
  patch?: Record<string, unknown>;
  preview?: string;
};

export type BackfillJobConfig<Row extends BackfillRow> = {
  jobName: string;
  tableName: string;
  selectColumns: readonly string[];
  valueColumn: string;
  parseRow: (row: BackfillRow) => Row | null;
  label: (row: Row) => string;
  shouldSkip?: (row: Row) => BackfillSkip | null;
  resolveValue: (row: Row) => Promise<BackfillResolvedValue | null>;
  orderBy?: {
    column: string;
    ascending?: boolean;
  };
  batchSize?: number;
  defaultDelayMs?: number;
};

type BackfillSummary = {
  processed: number;
  updated: number;
  skipped: Record<string, number>;
  skippedTotal: number;
  failed: number;
  dryRun: boolean;
  forceOverwrite: boolean;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isBackfillRow(value: unknown): value is BackfillRow {
  if (typeof value !== "object" || value === null) return false;
  const id = Reflect.get(value, "id");
  return typeof id === "string" && id.trim() !== "";
}

function parseRows<Row extends BackfillRow>(
  data: unknown,
  parseRow: (row: BackfillRow) => Row | null,
): Row[] {
  if (!Array.isArray(data)) return [];
  const rows: Row[] = [];
  for (const value of data) {
    if (isBackfillRow(value)) {
      const row = parseRow(value);
      if (row) rows.push(row);
    }
  }
  return rows;
}

function hasExistingValue(row: BackfillRow, column: string): boolean {
  const value = row[column];
  return typeof value === "string" && value.trim() !== "";
}

function incrementCounter(counters: Record<string, number>, key: string): void {
  counters[key] = (counters[key] ?? 0) + 1;
}

async function fetchRows<Row extends BackfillRow>(
  supabase: SupabaseClient,
  config: BackfillJobConfig<Row>,
): Promise<Row[]> {
  const batchSize = config.batchSize ?? 50;
  const rows: Row[] = [];
  let from = 0;

  while (true) {
    const to = from + batchSize - 1;
    let query = supabase
      .from(config.tableName)
      .select(config.selectColumns.join(", "))
      .range(from, to);

    if (config.orderBy) {
      query = query.order(config.orderBy.column, {
        ascending: config.orderBy.ascending ?? true,
      });
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to fetch ${config.tableName}: ${error.message}`);
    }

    const pageRows = parseRows<Row>(data, config.parseRow);
    rows.push(...pageRows);
    if (pageRows.length < batchSize) break;
    from += batchSize;
  }

  return rows;
}

export async function runBackfillJob<Row extends BackfillRow>(
  supabase: SupabaseClient,
  config: BackfillJobConfig<Row>,
): Promise<BackfillSummary> {
  const env = readBackfillEnv(config.defaultDelayMs ?? 500);

  console.log(`[backfill] starting ${config.jobName}`);
  console.log("[backfill] config:", {
    tableName: config.tableName,
    valueColumn: config.valueColumn,
    dryRun: env.dryRun,
    forceOverwrite: env.forceOverwrite,
    limit: env.limit,
    delayMs: env.delayMs,
  });

  const rows = await fetchRows(supabase, config);
  console.log(`[backfill] loaded ${rows.length} ${config.tableName} rows`);

  let processed = 0;
  let updated = 0;
  let failed = 0;
  const skipped: Record<string, number> = {};

  for (const row of rows) {
    if (env.limit !== null && processed >= env.limit) {
      console.log(`[backfill] limit ${env.limit} reached, stopping`);
      break;
    }

    processed += 1;
    const label = config.label(row);
    const progress = `${processed}/${rows.length}`;

    if (!env.forceOverwrite && hasExistingValue(row, config.valueColumn)) {
      incrementCounter(skipped, "existing_value");
      console.log(
        `[skip] (${progress}) ${label} - already has ${config.valueColumn}`,
      );
      continue;
    }

    const skip = config.shouldSkip?.(row) ?? null;
    if (skip) {
      incrementCounter(skipped, skip.reason);
      console.log(`[skip] (${progress}) ${label} - ${skip.message}`);
      continue;
    }

    let resolved: BackfillResolvedValue | null = null;
    try {
      resolved = await config.resolveValue(row);
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : "unknown";
      console.error(`[fail] (${progress}) ${label} - resolver threw:`, message);
      continue;
    }

    if (!resolved) {
      incrementCounter(skipped, "no_value_resolved");
      console.log(`[skip] (${progress}) ${label} - no value resolved`);
      continue;
    }

    const previewText =
      resolved.preview ??
      resolved.value ??
      (resolved.patch ? JSON.stringify(resolved.patch) : "");

    if (env.dryRun) {
      updated += 1;
      console.log(`[dry-run] (${progress}) ${label} -> ${previewText}`);
    } else {
      const updatePayload =
        resolved.patch !== undefined
          ? resolved.patch
          : resolved.column !== undefined && resolved.value !== undefined
            ? { [resolved.column]: resolved.value }
            : null;

      if (updatePayload === null) {
        failed += 1;
        console.error(
          `[fail] (${progress}) ${label} - resolver returned no update payload`,
        );
        continue;
      }

      const { error: updateError } = await supabase
        .from(config.tableName)
        .update(updatePayload)
        .eq("id", row.id);

      if (updateError) {
        failed += 1;
        console.error(
          `[fail] (${progress}) ${label} - update error:`,
          updateError.message,
        );
        continue;
      }

      updated += 1;
      console.log(`[ok]   (${progress}) ${label} -> ${previewText}`);
    }

    if (env.delayMs > 0) {
      await delay(env.delayMs);
    }
  }

  const skippedTotal = Object.values(skipped).reduce(
    (total, count) => total + count,
    0,
  );

  const summary: BackfillSummary = {
    processed,
    updated,
    skipped,
    skippedTotal,
    failed,
    dryRun: env.dryRun,
    forceOverwrite: env.forceOverwrite,
  };

  console.log("[backfill] summary:", summary);
  if (failed > 0) {
    process.exitCode = 2;
  }

  return summary;
}
