import { formatEventLifecycleStatusLabel } from "@/src/lib/validation/eventLifecycleStatus";
import { buildSeriesHubPath } from "@/src/lib/routes/explorerUrls";

export type MergedIntoSeriesDestination = {
  name: string;
  slug: string;
};

export type EventHistoryRow =
  | { kind: "status"; label: "Status"; value: string }
  | {
      kind: "merged_into";
      label: "Merged Into";
      destinationName: string;
      destinationHref: string;
    };

export function buildEventHistoryRows(input: {
  lifecycleStatus: string | null | undefined;
  lifecycleNote?: string | null | undefined;
  mergedIntoSeries?: MergedIntoSeriesDestination | null;
}): EventHistoryRow[] | null {
  void input.lifecycleNote;

  const statusLabel = formatEventLifecycleStatusLabel(input.lifecycleStatus);
  const rows: EventHistoryRow[] = [];

  if (statusLabel) {
    rows.push({ kind: "status", label: "Status", value: statusLabel });
  }

  if (input.lifecycleStatus === "merged" && input.mergedIntoSeries) {
    const name = input.mergedIntoSeries.name.trim();
    const slug = input.mergedIntoSeries.slug.trim();
    const destinationHref = buildSeriesHubPath({ slug, id: slug });
    if (name !== "" && destinationHref) {
      rows.push({
        kind: "merged_into",
        label: "Merged Into",
        destinationName: name,
        destinationHref,
      });
    }
  }

  return rows.length > 0 ? rows : null;
}
