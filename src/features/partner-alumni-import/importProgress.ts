import type { PartnerAlumniImportProcessingPhase } from "./types";

export const IMPORT_PROGRESS = {
  parsing: "Parsing spreadsheet…",
  applyingMapping: "Applying column mapping…",
  validating:
    "Checking the uploaded file for duplicate companies, missing required fields, and invalid websites…",
  matching: "Matching companies…",
  materializingCompanies: "Creating companies…",
  materializingMembers: "Linking version members…",
  applyingDecisions: "Applying review decisions…",
  bulkAccept: "Accepting auto-ready matches…",
  loadingRows: "Loading rows…",
  openingMapping: "Opening column mapping…",
  loadingSummary: "Loading import summary…",
  acknowledgingReview: "Saving review acknowledgment…",
  acknowledgingCreateNew: "Saving create-new acknowledgment…",
} as const;

export function processingPhaseLabel(
  phase: PartnerAlumniImportProcessingPhase | null | undefined,
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
    case "materializing_members":
      return IMPORT_PROGRESS.materializingMembers;
    default:
      return null;
  }
}
