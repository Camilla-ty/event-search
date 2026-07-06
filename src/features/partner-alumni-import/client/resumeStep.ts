import type { ImportScope, ImportStep } from "./types";
import type { PartnerAlumniImportBatchStatus } from "../types";

export function importFlowBasePath(scope: ImportScope, batchId: string): string {
  return `/admin/events/series/${scope.seriesId}/partner-alumni/versions/${scope.versionId}/import/${batchId}`;
}

export function importNewPath(scope: ImportScope): string {
  return `/admin/events/series/${scope.seriesId}/partner-alumni/versions/${scope.versionId}/import/new`;
}

export function flowHref(scope: ImportScope, batchId: string, step: ImportStep): string {
  return `${importFlowBasePath(scope, batchId)}?step=${step}`;
}

export function parseImportStep(raw: string | null | undefined): ImportStep | null {
  if (
    raw === "upload" ||
    raw === "mapping" ||
    raw === "validation" ||
    raw === "review" ||
    raw === "summary"
  ) {
    return raw;
  }
  return null;
}

export function defaultStepForBatchStatus(status: PartnerAlumniImportBatchStatus): ImportStep {
  switch (status) {
    case "uploaded":
      return "mapping";
    case "review":
      return "review";
    case "imported":
    case "discarded":
      return "summary";
    default:
      return "mapping";
  }
}

export function stepperIndex(step: ImportStep): number {
  const order: ImportStep[] = ["upload", "validation", "review", "summary"];
  if (step === "mapping") return 0;
  const idx = order.indexOf(step);
  return idx >= 0 ? idx : 0;
}

export function resolveStepForBatch(
  status: PartnerAlumniImportBatchStatus,
  requested: ImportStep | null,
): ImportStep {
  if (status === "imported" || status === "discarded") {
    return "summary";
  }

  if (status === "review") {
    if (
      requested === "review" ||
      requested === "validation" ||
      requested === "mapping" ||
      requested === "upload"
    ) {
      return requested;
    }
    return "review";
  }

  if (requested === "upload" || requested === "mapping" || requested === "validation") {
    return requested;
  }
  return defaultStepForBatchStatus(status);
}
