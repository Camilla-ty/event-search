/** Supabase PostgREST defaults to 1,000 rows per request. */
export const SUPABASE_DEFAULT_PAGE_SIZE = 1000;

type SupabasePageResult<TRow> = {
  data: TRow[] | null;
  error: { message: string } | null;
};

/** Fetch every row from a ranged Supabase select (avoids the 1,000-row default cap). */
export async function fetchAllPaginatedSupabaseRows<TRow>(
  runPage: (range: { from: number; to: number }) => Promise<SupabasePageResult<TRow>>,
  pageSize = SUPABASE_DEFAULT_PAGE_SIZE,
): Promise<TRow[]> {
  const rows: TRow[] = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await runPage({ from, to });
    if (error) {
      throw new Error(error.message);
    }

    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}
