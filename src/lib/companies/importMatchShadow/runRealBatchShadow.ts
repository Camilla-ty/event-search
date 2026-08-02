import type { SupabaseClient } from "@supabase/supabase-js";

import { buildImportMatchContext } from "@/src/lib/companies/companyImportMatching";
import {
  createSupabaseImportMatchCandidateSource,
  loadImportMatchContextFromCandidateSource,
} from "@/src/lib/companies/importMatchCandidateLoader";
import { loadFullDirectoryCatalogForShadow } from "@/src/lib/companies/importMatchShadow/loadFullDirectoryCatalog";
import {
  listRecentImportBatchesForShadow,
  loadImportBatchForShadow,
  loadPartnerAlumniBulkShadowRowsFromImportBatch,
} from "@/src/lib/companies/importMatchShadow/loadRealBatches";
import {
  shadowCompareImportMatchRows,
  type ImportMatchShadowCompareResult,
} from "@/src/lib/companies/importMatchShadow/runShadowBatch";
import type { ImportMatchParityImporter } from "@/src/lib/companies/importMatchParity/types";

export type RealBatchShadowReport = {
  results: ImportMatchShadowCompareResult[];
  skipped: Array<{ importer: ImportMatchParityImporter; reason: string }>;
  candidate_source: "supabase";
};

/**
 * Read-only shadow compare against real existing import batches.
 * Uses SELECTs only — never updates batches, rows, or publishes.
 *
 * Candidate context is built via createSupabaseImportMatchCandidateSource
 * (exact name/alias RPCs + domain/website queries). Requires migration
 * 20260802180000_import_match_exact_name_alias_keys.
 */
export async function runRealBatchImportMatchShadow(
  supabase: SupabaseClient,
  options?: {
    /** When omitted / null, compare every listed batch for each importer. */
    maxBatchesPerImporter?: number | null;
    maxRowsPerBatch?: number | null;
  },
): Promise<RealBatchShadowReport> {
  const maxBatches = options?.maxBatchesPerImporter ?? null;
  const maxRows = options?.maxRowsPerBatch ?? null;

  const catalog = await loadFullDirectoryCatalogForShadow(supabase);
  const fullContext = buildImportMatchContext(catalog.companies, catalog.companyDomains);
  const candidateSource = createSupabaseImportMatchCandidateSource(supabase);

  const listLimit = maxBatches === null ? 100 : Math.max(maxBatches, 1);
  const listed = await listRecentImportBatchesForShadow(supabase, listLimit);
  const results: ImportMatchShadowCompareResult[] = [];
  const skipped: RealBatchShadowReport["skipped"] = [];

  const byImporter = new Map<ImportMatchParityImporter, typeof listed>();
  for (const entry of listed) {
    const list = byImporter.get(entry.importer) ?? [];
    list.push(entry);
    byImporter.set(entry.importer, list);
  }

  for (const importer of ["sponsor", "exhibitor", "partner_alumni"] as const) {
    const entries = byImporter.get(importer) ?? [];
    if (entries.length === 0) {
      skipped.push({ importer, reason: "no existing batches" });
      continue;
    }

    const selected =
      maxBatches === null ? entries : entries.slice(0, maxBatches);

    for (const entry of selected) {
      const loaded = await loadImportBatchForShadow({
        supabase,
        importer,
        batchId: entry.batch_id,
        contextId: entry.context_id,
      });
      const rows =
        maxRows === null ? loaded.rows : loaded.rows.slice(0, maxRows);
      if (rows.length === 0) {
        skipped.push({ importer, reason: `batch ${entry.batch_id} has no rows` });
        continue;
      }

      const candidateContext = await loadImportMatchContextFromCandidateSource(
        candidateSource,
        rows,
      );

      results.push(
        await shadowCompareImportMatchRows({
          importer,
          rows,
          fullContext,
          candidateContext,
          overlays: loaded.overlays,
          batchId: entry.batch_id,
        }),
      );

      if (importer === "partner_alumni") {
        const bulk = await loadPartnerAlumniBulkShadowRowsFromImportBatch({
          supabase,
          batchId: entry.batch_id,
          versionId: entry.context_id,
        });
        const bulkRows =
          maxRows === null ? bulk.rows : bulk.rows.slice(0, maxRows);
        const bulkCandidateContext = await loadImportMatchContextFromCandidateSource(
          candidateSource,
          bulkRows,
        );
        results.push(
          await shadowCompareImportMatchRows({
            importer: "partner_alumni_bulk",
            rows: bulkRows,
            fullContext,
            candidateContext: bulkCandidateContext,
            overlays: bulk.overlays,
            batchId: entry.batch_id,
          }),
        );
      }
    }
  }

  if (!results.some((r) => r.summary.importer === "partner_alumni_bulk")) {
    if (!byImporter.has("partner_alumni")) {
      skipped.push({
        importer: "partner_alumni_bulk",
        reason: "no PA import batches to derive from",
      });
    }
  }

  return { results, skipped, candidate_source: "supabase" };
}
