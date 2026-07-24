import type { ImportStep } from "./types";
import type { ExhibitorImportBatchStatus } from "../types";

export function defaultStepForBatchStatus(status: ExhibitorImportBatchStatus): ImportStep {
  switch (status) {
    case "uploaded":
      return "mapping";
    case "review":
      return "review";
    case "draft":
      return "draft";
    case "published":
    case "discarded":
      return "publish";
    default:
      return "mapping";
  }
}

export function flowHref(batchId: string, step: ImportStep): string {
  return `/admin/exhibitor-imports/${batchId}?step=${step}`;
}

export function parseImportStep(raw: string | null | undefined): ImportStep | null {
  if (
    raw === "upload" ||
    raw === "mapping" ||
    raw === "validation" ||
    raw === "review" ||
    raw === "draft" ||
    raw === "publish"
  ) {
    return raw;
  }
  return null;
}

export function stepperIndex(step: ImportStep): number {
  const order: ImportStep[] = ["upload", "validation", "review", "draft", "publish"];
  if (step === "mapping") return 0;
  const idx = order.indexOf(step);
  return idx >= 0 ? idx : 0;
}

export function resolveStepForBatch(
  status: ExhibitorImportBatchStatus,
  requested: ImportStep | null,
): ImportStep {
  if (status === "published" || status === "discarded") {
    return "publish";
  }

  if (status === "draft") {
    if (requested === "publish" || requested === "draft") return requested;
    return "draft";
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
