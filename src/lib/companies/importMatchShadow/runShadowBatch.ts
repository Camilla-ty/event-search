import {
  buildImportMatchContext,
  type ImportMatchContext,
} from "@/src/lib/companies/companyImportMatching";
import {
  createMemoryImportMatchCandidateSource,
  loadImportMatchContextFromCandidateSource,
  type ImportMatchCompanyCatalog,
} from "@/src/lib/companies/importMatchCandidateLoader";
import {
  assertImportMatchShadowEqual,
} from "@/src/lib/companies/importMatchShadow/compare";
import {
  runImportMatchShadowRow,
  type ShadowLiveOverlays,
} from "@/src/lib/companies/importMatchShadow/runShadowRow";
import type {
  ImportMatchShadowBatchSummary,
  ImportMatchShadowPersistedDecision,
  ImportMatchShadowRowInput,
} from "@/src/lib/companies/importMatchShadow/types";
import type { ImportMatchParityImporter } from "@/src/lib/companies/importMatchParity/types";

export type ImportMatchShadowCompareResult = {
  summary: ImportMatchShadowBatchSummary;
  fullDecisions: ImportMatchShadowPersistedDecision[];
  candidateDecisions: ImportMatchShadowPersistedDecision[];
};

/**
 * Read-only row-by-row shadow compare: full-directory context vs candidate context.
 * Does not write or publish. One mismatch fails with a clear field diff.
 */
export async function shadowCompareImportMatchRows(params: {
  importer: ImportMatchParityImporter;
  rows: readonly ImportMatchShadowRowInput[];
  fullContext: ImportMatchContext;
  candidateContext: ImportMatchContext;
  overlays?: ShadowLiveOverlays;
  batchId?: string | null;
}): Promise<ImportMatchShadowCompareResult> {
  const fullDecisions: ImportMatchShadowPersistedDecision[] = [];
  const candidateDecisions: ImportMatchShadowPersistedDecision[] = [];

  for (const row of params.rows) {
    const full = await runImportMatchShadowRow({
      importer: params.importer,
      row,
      context: params.fullContext,
      overlays: params.overlays,
    });
    const candidate = await runImportMatchShadowRow({
      importer: params.importer,
      row,
      context: params.candidateContext,
      overlays: params.overlays,
    });

    assertImportMatchShadowEqual(
      candidate,
      full,
      `shadow ${params.importer} full vs candidate`,
    );

    fullDecisions.push(full);
    candidateDecisions.push(candidate);
  }

  return {
    summary: {
      importer: params.importer,
      batch_id: params.batchId ?? null,
      row_count: params.rows.length,
      compared: params.rows.length,
      matched: params.rows.length,
    },
    fullDecisions,
    candidateDecisions,
  };
}

/**
 * Convenience: build full + candidate contexts from an in-memory catalog, then compare.
 */
export async function shadowCompareAgainstCatalog(params: {
  importer: ImportMatchParityImporter;
  rows: readonly ImportMatchShadowRowInput[];
  catalog: ImportMatchCompanyCatalog;
  overlays?: ShadowLiveOverlays;
  batchId?: string | null;
}): Promise<ImportMatchShadowCompareResult> {
  const fullContext = buildImportMatchContext(
    params.catalog.companies,
    params.catalog.companyDomains,
  );
  const candidateContext = await loadImportMatchContextFromCandidateSource(
    createMemoryImportMatchCandidateSource(params.catalog),
    params.rows.map((row) => ({
      normalized_domain: row.normalized_domain,
      normalized_website: row.normalized_website,
      normalized_company_name: row.normalized_company_name,
    })),
  );

  return shadowCompareImportMatchRows({
    importer: params.importer,
    rows: params.rows,
    fullContext,
    candidateContext,
    overlays: params.overlays,
    batchId: params.batchId,
  });
}
