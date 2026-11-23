import type { ImportStep } from "./types";
import type { SponsorImportBatchStatus, SponsorImportProcessingPhase } from "../types";
import { flowHref } from "./resumeStep";

export function buildImportDraftStepHref(batchId: string): string {
  return flowHref(batchId, "draft");
}

/** Review UI must not stay visible once the batch has moved to draft. */
export function shouldRedirectReviewToDraft(
  batchStatus: SponsorImportBatchStatus,
  activeStep: ImportStep,
): boolean {
  return batchStatus === "draft" && activeStep === "review";
}

/** Import-to-draft materialization phases are unnecessary when finalize already completed. */
export function shouldSkipImportToDraftMaterialization(
  batchStatus: SponsorImportBatchStatus,
): boolean {
  return batchStatus === "draft";
}

/**
 * An import step (company creation or draft links) holds the batch, e.g. from another window or
 * a request still running after a page reload; starting another would be rejected.
 */
export function isImportToDraftStepRunning(
  processingPhase: SponsorImportProcessingPhase | null,
): boolean {
  return processingPhase === "materializing_companies" || processingPhase === "importing_to_draft";
}

export function shouldShowImportToDraftButton(batchStatus: SponsorImportBatchStatus): boolean {
  return batchStatus === "review";
}
