import { Badge } from "@/src/components/common";

import type { SponsorImportBatchStatus } from "../types";

const LABELS: Record<SponsorImportBatchStatus, string> = {
  uploaded: "Uploaded",
  review: "Review",
  draft: "Draft",
  published: "Published",
  discarded: "Discarded",
};

const VARIANT: Record<SponsorImportBatchStatus, "default" | "success" | "warning" | "neutral"> = {
  uploaded: "neutral",
  review: "warning",
  draft: "warning",
  published: "success",
  discarded: "neutral",
};

export function ImportBatchStatusBadge({ status }: { status: string }) {
  const key = status as SponsorImportBatchStatus;
  const label = LABELS[key] ?? status;
  const variant = VARIANT[key] ?? "default";
  return <Badge variant={variant}>{label}</Badge>;
}
