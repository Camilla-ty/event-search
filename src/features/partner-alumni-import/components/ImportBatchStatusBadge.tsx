import { Badge } from "@/src/components/common";

import type { PartnerAlumniImportBatchStatus } from "../types";

const LABELS: Record<PartnerAlumniImportBatchStatus, string> = {
  uploaded: "Uploaded",
  review: "Review",
  imported: "Imported",
  discarded: "Discarded",
};

const VARIANT: Record<
  PartnerAlumniImportBatchStatus,
  "default" | "success" | "warning" | "neutral"
> = {
  uploaded: "neutral",
  review: "warning",
  imported: "success",
  discarded: "neutral",
};

export function ImportBatchStatusBadge({ status }: { status: string }) {
  const key = status as PartnerAlumniImportBatchStatus;
  const label = LABELS[key] ?? status;
  const variant = VARIANT[key] ?? "default";
  return <Badge variant={variant}>{label}</Badge>;
}
