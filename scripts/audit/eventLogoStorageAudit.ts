import {
  isEventSeriesIdLogoStorageSegment,
  parseEventSeriesLogoStoragePathFromUrl,
} from "@/src/features/events/server/eventSeriesLogoStorage";

export const EVENT_SERIES_PREFIX = "event-series";
export const EVENT_EDITIONS_PREFIX = "event-editions";

const EVENT_SERIES_LOGO_BUCKET_PATTERN =
  /^event-series\/([^/]+)\/logo\.([a-z0-9]+)$/i;
const EVENT_EDITIONS_LOGO_BUCKET_PATTERN =
  /^event-editions\/([^/]+)\/logo\.([a-z0-9]+)$/i;

export type EventLogoStorageClassification =
  | "active_event_series"
  | "legacy_event_series"
  | "orphan_event_editions"
  | "unknown";

export type EventSeriesAuditRow = {
  id: string;
  logo_url: string | null;
};

export type ParsedEventLogoBucketPath = {
  namespace: typeof EVENT_SERIES_PREFIX | typeof EVENT_EDITIONS_PREFIX;
  identitySegment: string;
  extension: string;
};

export type ClassifiedEventLogoObject = {
  bucket: string;
  path: string;
  namespace: typeof EVENT_SERIES_PREFIX | typeof EVENT_EDITIONS_PREFIX | "unknown";
  classification: EventLogoStorageClassification;
  reason: string;
  identity_segment: string | null;
  extension: string | null;
  series_id: string | null;
  referenced_by_logo_url: boolean;
};

export type EventLogoStorageAuditSummary = {
  type: "summary";
  dry_run: true;
  bucket: string;
  total_event_series_objects: number;
  active_event_series_objects: number;
  legacy_event_series_objects: number;
  total_event_editions_objects: number;
  orphan_event_editions_objects: number;
  unknown_objects: number;
};

export type EventLogoCleanupPlan = {
  type: "cleanup_plan";
  dry_run: true;
  keep_paths: string[];
  delete_candidate_paths: string[];
  review_paths: string[];
  steps: string[];
};

export function parseEventLogoBucketPath(
  path: string,
): ParsedEventLogoBucketPath | null {
  const trimmed = path.trim();
  if (!trimmed) return null;

  const seriesMatch = EVENT_SERIES_LOGO_BUCKET_PATTERN.exec(trimmed);
  if (seriesMatch) {
    const identitySegment = seriesMatch[1] ?? "";
    const extension = (seriesMatch[2] ?? "").toLowerCase();
    if (!identitySegment || !extension) return null;
    return {
      namespace: EVENT_SERIES_PREFIX,
      identitySegment,
      extension,
    };
  }

  const editionMatch = EVENT_EDITIONS_LOGO_BUCKET_PATTERN.exec(trimmed);
  if (editionMatch) {
    const identitySegment = editionMatch[1] ?? "";
    const extension = (editionMatch[2] ?? "").toLowerCase();
    if (!identitySegment || !extension) return null;
    return {
      namespace: EVENT_EDITIONS_PREFIX,
      identitySegment,
      extension,
    };
  }

  return null;
}

export function classifyEventLogoStorageObject(params: {
  bucket: string;
  path: string;
  seriesById: ReadonlyMap<string, EventSeriesAuditRow>;
}): ClassifiedEventLogoObject {
  const { bucket, path, seriesById } = params;
  const parsed = parseEventLogoBucketPath(path);

  if (path.startsWith(`${EVENT_EDITIONS_PREFIX}/`)) {
    if (parsed?.namespace === EVENT_EDITIONS_PREFIX) {
      return {
        bucket,
        path,
        namespace: EVENT_EDITIONS_PREFIX,
        classification: "orphan_event_editions",
        reason: "event_edition_logos_deprecated",
        identity_segment: parsed.identitySegment,
        extension: parsed.extension,
        series_id: null,
        referenced_by_logo_url: false,
      };
    }

    return {
      bucket,
      path,
      namespace: EVENT_EDITIONS_PREFIX,
      classification: "unknown",
      reason: "unparseable_event_editions_path",
      identity_segment: null,
      extension: null,
      series_id: null,
      referenced_by_logo_url: false,
    };
  }

  if (path.startsWith(`${EVENT_SERIES_PREFIX}/`)) {
    if (!parsed || parsed.namespace !== EVENT_SERIES_PREFIX) {
      return {
        bucket,
        path,
        namespace: EVENT_SERIES_PREFIX,
        classification: "unknown",
        reason: "unparseable_event_series_path",
        identity_segment: null,
        extension: null,
        series_id: null,
        referenced_by_logo_url: false,
      };
    }

    if (!isEventSeriesIdLogoStorageSegment(parsed.identitySegment)) {
      return {
        bucket,
        path,
        namespace: EVENT_SERIES_PREFIX,
        classification: "legacy_event_series",
        reason: "domain_based_identity_segment",
        identity_segment: parsed.identitySegment,
        extension: parsed.extension,
        series_id: null,
        referenced_by_logo_url: false,
      };
    }

    const series = seriesById.get(parsed.identitySegment);
    if (!series) {
      return {
        bucket,
        path,
        namespace: EVENT_SERIES_PREFIX,
        classification: "unknown",
        reason: "series_id_not_found",
        identity_segment: parsed.identitySegment,
        extension: parsed.extension,
        series_id: parsed.identitySegment,
        referenced_by_logo_url: false,
      };
    }

    const activeParsed = parseEventSeriesLogoStoragePathFromUrl(series.logo_url);
    const referencedByLogoUrl = activeParsed?.bucketRelativePath === path;
    if (referencedByLogoUrl) {
      return {
        bucket,
        path,
        namespace: EVENT_SERIES_PREFIX,
        classification: "active_event_series",
        reason: "referenced_by_event_series_logo_url",
        identity_segment: parsed.identitySegment,
        extension: parsed.extension,
        series_id: parsed.identitySegment,
        referenced_by_logo_url: true,
      };
    }

    return {
      bucket,
      path,
      namespace: EVENT_SERIES_PREFIX,
      classification: "unknown",
      reason: "unreferenced_canonical_series_path",
      identity_segment: parsed.identitySegment,
      extension: parsed.extension,
      series_id: parsed.identitySegment,
      referenced_by_logo_url: false,
    };
  }

  return {
    bucket,
    path,
    namespace: "unknown",
    classification: "unknown",
    reason: "outside_event_logo_prefixes",
    identity_segment: null,
    extension: null,
    series_id: null,
    referenced_by_logo_url: false,
  };
}

export function summarizeEventLogoAudit(params: {
  bucket: string;
  objects: readonly ClassifiedEventLogoObject[];
}): EventLogoStorageAuditSummary {
  const eventSeriesObjects = params.objects.filter(
    (object) => object.namespace === EVENT_SERIES_PREFIX,
  );
  const eventEditionObjects = params.objects.filter(
    (object) => object.namespace === EVENT_EDITIONS_PREFIX,
  );

  return {
    type: "summary",
    dry_run: true,
    bucket: params.bucket,
    total_event_series_objects: eventSeriesObjects.length,
    active_event_series_objects: eventSeriesObjects.filter(
      (object) => object.classification === "active_event_series",
    ).length,
    legacy_event_series_objects: eventSeriesObjects.filter(
      (object) => object.classification === "legacy_event_series",
    ).length,
    total_event_editions_objects: eventEditionObjects.length,
    orphan_event_editions_objects: eventEditionObjects.filter(
      (object) => object.classification === "orphan_event_editions",
    ).length,
    unknown_objects: params.objects.filter(
      (object) => object.classification === "unknown",
    ).length,
  };
}

export function buildEventLogoCleanupPlan(
  objects: readonly ClassifiedEventLogoObject[],
): EventLogoCleanupPlan {
  const keepPaths = objects
    .filter((object) => object.classification === "active_event_series")
    .map((object) => object.path);

  const deleteCandidatePaths = objects
    .filter(
      (object) =>
        object.classification === "legacy_event_series" ||
        object.classification === "orphan_event_editions" ||
        (object.classification === "unknown" &&
          (object.reason === "unreferenced_canonical_series_path" ||
            object.reason === "series_id_not_found")),
    )
    .map((object) => object.path);

  const reviewPaths = objects
    .filter(
      (object) =>
        object.classification === "unknown" &&
        object.reason !== "unreferenced_canonical_series_path" &&
        object.reason !== "series_id_not_found",
    )
    .map((object) => object.path);

  const steps = [
    "Dry-run only: do not delete Storage objects until a follow-up cleanup script is approved.",
    "Delete legacy event-series domain-based logo objects after confirming no event_series.logo_url references them.",
    "Delete all event-editions logo objects; edition logos are deprecated.",
    "Delete unreferenced canonical event-series/{seriesId}/logo.{ext} objects after confirming they are stale uploads or duplicates.",
    "Manually review unknown/unparseable paths before any deletion.",
    "Keep active event-series logo objects referenced by event_series.logo_url.",
  ];

  return {
    type: "cleanup_plan",
    dry_run: true,
    keep_paths: keepPaths,
    delete_candidate_paths: deleteCandidatePaths,
    review_paths: reviewPaths,
    steps,
  };
}

export function buildSeriesByIdMap(
  rows: readonly EventSeriesAuditRow[],
): Map<string, EventSeriesAuditRow> {
  const map = new Map<string, EventSeriesAuditRow>();
  for (const row of rows) {
    map.set(row.id, row);
  }
  return map;
}

/** Paths under company-logos that this cleanup script is allowed to inspect. */
export function isEventLogoCleanupInspectablePath(path: string): boolean {
  const trimmed = path.trim();
  return (
    trimmed.startsWith(`${EVENT_SERIES_PREFIX}/`) ||
    trimmed.startsWith(`${EVENT_EDITIONS_PREFIX}/`)
  );
}

/**
 * Live cleanup may delete only legacy event-series and orphan event-editions objects.
 * Never deletes active, unknown, or logo_url-referenced objects.
 */
export function isEventLogoLiveCleanupDeleteTarget(
  object: ClassifiedEventLogoObject,
): boolean {
  if (!isEventLogoCleanupInspectablePath(object.path)) {
    return false;
  }
  if (object.referenced_by_logo_url) {
    return false;
  }
  return (
    object.classification === "legacy_event_series" ||
    object.classification === "orphan_event_editions"
  );
}

export function selectEventLogoLiveCleanupDeletePaths(
  objects: readonly ClassifiedEventLogoObject[],
): string[] {
  return objects
    .filter((object) => isEventLogoLiveCleanupDeleteTarget(object))
    .map((object) => object.path);
}

export const EVENT_LOGO_CLEANUP_ROLLBACK_NOTE =
  "Deleted Storage objects must be restored from backup if needed. The database is not modified by this script.";

export type EventLogoLiveCleanupAction =
  | "would_delete"
  | "deleted"
  | "skipped"
  | "failed";

export type EventLogoLiveCleanupObjectRecord = {
  type: "action";
  path: string;
  classification: EventLogoStorageClassification;
  action: EventLogoLiveCleanupAction;
  reason: string;
};

export type EventLogoLiveCleanupSummary = {
  type: "cleanup_summary";
  inspected: number;
  deleted: number;
  skipped: number;
  failed: number;
  dryRun: boolean;
};

export function buildEventLogoLiveCleanupObjectRecords(params: {
  objects: readonly ClassifiedEventLogoObject[];
  deletedPaths: ReadonlySet<string>;
  failedPaths: ReadonlyMap<string, string>;
  dryRun: boolean;
}): EventLogoLiveCleanupObjectRecord[] {
  return params.objects.map((object) => {
    if (isEventLogoLiveCleanupDeleteTarget(object)) {
      if (params.dryRun) {
        return {
          type: "action" as const,
          path: object.path,
          classification: object.classification,
          action: "would_delete" as const,
          reason: object.reason,
        };
      }

      if (params.failedPaths.has(object.path)) {
        return {
          type: "action" as const,
          path: object.path,
          classification: object.classification,
          action: "failed" as const,
          reason: params.failedPaths.get(object.path) ?? "delete_failed",
        };
      }

      if (params.deletedPaths.has(object.path)) {
        return {
          type: "action" as const,
          path: object.path,
          classification: object.classification,
          action: "deleted" as const,
          reason: object.reason,
        };
      }
    }

    return {
      type: "action" as const,
      path: object.path,
      classification: object.classification,
      action: "skipped" as const,
      reason: object.referenced_by_logo_url
        ? "referenced_by_event_series_logo_url"
        : object.classification,
    };
  });
}

export function summarizeEventLogoLiveCleanup(params: {
  records: readonly EventLogoLiveCleanupObjectRecord[];
  dryRun: boolean;
}): EventLogoLiveCleanupSummary {
  let deleted = 0;
  let skipped = 0;
  let failed = 0;

  for (const record of params.records) {
    switch (record.action) {
      case "would_delete":
        deleted += 1;
        break;
      case "deleted":
        deleted += 1;
        break;
      case "skipped":
        skipped += 1;
        break;
      case "failed":
        failed += 1;
        break;
      default: {
        const _exhaustive: never = record.action;
        void _exhaustive;
      }
    }
  }

  return {
    type: "cleanup_summary",
    inspected: params.records.length,
    deleted,
    skipped,
    failed,
    dryRun: params.dryRun,
  };
}
