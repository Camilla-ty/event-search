export type BackfillEnv = {
  dryRun: boolean;
  forceOverwrite: boolean;
  limit: number | null;
  delayMs: number;
};

function parseBooleanEnv(value: string | undefined): boolean {
  return value === "1" || value === "true";
}

function parseOptionalPositiveInteger(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return null;
  return parsed;
}

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return fallback;
  return parsed;
}

export function readBackfillEnv(defaultDelayMs = 500): BackfillEnv {
  return {
    dryRun: parseBooleanEnv(process.env.BACKFILL_DRY_RUN),
    forceOverwrite: parseBooleanEnv(process.env.BACKFILL_FORCE_OVERWRITE),
    limit: parseOptionalPositiveInteger(process.env.BACKFILL_LIMIT),
    delayMs: parsePositiveInteger(
      process.env.BACKFILL_DELAY_MS,
      defaultDelayMs,
    ),
  };
}
