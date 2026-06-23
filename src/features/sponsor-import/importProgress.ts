import type { SponsorImportProcessingPhase } from "./types";

export const IMPORT_PROGRESS = {
  parsing: "Parsing spreadsheet…",
  applyingMapping: "Applying column mapping…",
  validating:
    "Checking the uploaded file for duplicate companies, missing required fields, invalid websites, and tier data…",
  matching: "Matching companies…",
  materializingCompanies: "Creating companies…",
  importingToDraft: "Creating draft links…",
  publishing: "Publishing to edition…",
  loadingDraft: "Loading draft links…",
  loadingPublishSummary: "Loading publish summary…",
  applyingDecisions: "Applying review decisions…",
  bulkAccept: "Accepting auto-ready matches…",
  loadingRows: "Loading rows…",
  openingMapping: "Opening column mapping…",
} as const;

export function processingPhaseLabel(
  phase: SponsorImportProcessingPhase | null | undefined,
): string | null {
  if (!phase) return null;

  switch (phase) {
    case "parsing":
      return IMPORT_PROGRESS.parsing;
    case "validating":
      return IMPORT_PROGRESS.validating;
    case "matching":
      return IMPORT_PROGRESS.matching;
    case "materializing_companies":
      return IMPORT_PROGRESS.materializingCompanies;
    case "importing_to_draft":
      return IMPORT_PROGRESS.importingToDraft;
    case "publishing":
      return IMPORT_PROGRESS.publishing;
    default:
      return null;
  }
}
