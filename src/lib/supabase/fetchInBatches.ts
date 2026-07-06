/** Keep PostgREST `.in()` filters small — large UUID lists blow URL limits and fail as `TypeError: fetch failed`. */
export const SUPABASE_IN_FILTER_BATCH_SIZE = 100;

type BatchQueryResult<TRow> = {
  data: TRow[] | null;
  error: { message: string } | null;
};

function uniqueNonEmptyIds(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    const id = raw.trim();
    if (id === "" || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** Run a Supabase `.in("id", …)` query in batches and merge rows in input order groups. */
export async function fetchAllByIdInBatches<TRow>(
  ids: readonly string[],
  runBatch: (batchIds: string[]) => PromiseLike<BatchQueryResult<TRow>>,
  batchSize = SUPABASE_IN_FILTER_BATCH_SIZE,
): Promise<TRow[]> {
  const uniqueIds = uniqueNonEmptyIds(ids);
  if (uniqueIds.length === 0) return [];

  const rows: TRow[] = [];
  for (let offset = 0; offset < uniqueIds.length; offset += batchSize) {
    const batchIds = uniqueIds.slice(offset, offset + batchSize);
    const { data, error } = await runBatch(batchIds);
    if (error) {
      throw new Error(error.message);
    }
    rows.push(...(data ?? []));
  }

  return rows;
}
