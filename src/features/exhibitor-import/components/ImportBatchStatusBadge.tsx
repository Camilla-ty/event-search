import { Badge } from "@/src/components/common";

import type { ExhibitorImportBatchStatus } from "../types";

const LABELS: Record<ExhibitorImportBatchStatus, string> = {
  uploaded: "Uploaded",
  review: "Review",
  draft: "Draft",
  published: "Published",
  discarded: "Discarded",
};

const VARIANT: Record<ExhibitorImportBatchStatus, "default" | "success" | "warning" | "neutral"> = {
  uploaded: "neutral",
  review: "warning",
  draft: "warning",
  published: "success",
  discarded: "neutral",
};

export function ImportBatchStatusBadge({ status }: { status: string }) {
  const key = status as ExhibitorImportBatchStatus;
  const label = LABELS[key] ?? status;
  const variant = VARIANT[key] ?? "default";
  return <Badge variant={variant}>{label}</Badge>;
}
