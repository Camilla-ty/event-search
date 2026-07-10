import { isCompanyLogoStorageUrl } from "@/src/lib/companies/isCompanyLogoStorageUrl";
import {
  parseCompanyLogoStoragePathFromUrl,
} from "@/src/features/companies/server/companyLogoStorage";
import {
  parseEventSeriesLogoStoragePathFromUrl,
} from "@/src/features/events/server/eventSeriesLogoStorage";
import {
  parseVenueLogoStoragePathFromUrl,
} from "@/src/features/venues/server/venueLogoStorage";
import { bucketRelativePathFromLogoReference } from "@/src/lib/storage/bucketRelativeLogoPath";
import {
  BUCKET_RELATIVE_STORAGE_LOGO_PATTERN,
  isBucketRelativeStorageLogoPath,
} from "@/src/lib/storage/resolveStorageLogoDisplayUrl";

import {
  planCompanyLogoUrlToRelativePath,
  planEventSeriesLogoUrlToRelativePath,
  planVenueLogoUrlToRelativePath,
} from "../../lib/logoUrlRelativeMigration";

export type LogoSourceTable = "companies" | "event_series" | "venues";

export type CatalogLogoPathSkipReason = "empty" | "external_url" | "invalid";

export type ResolveCatalogLogoStoragePathResult =
  | { kind: "include"; path: string }
  | { kind: "skip"; reason: CatalogLogoPathSkipReason };

export type LogoUrlRow = {
  id: string;
  logo_url: string | null;
};

function idsMatch(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function isCanonicalCompanyPath(rowId: string, path: string): boolean {
  const parsed = parseCompanyLogoStoragePathFromUrl(path);
  return (
    parsed !== null &&
    !parsed.isLegacyPath &&
    parsed.companyId !== null &&
    idsMatch(parsed.companyId, rowId) &&
    BUCKET_RELATIVE_STORAGE_LOGO_PATTERN.test(parsed.bucketRelativePath)
  );
}

function isCanonicalEventSeriesPath(rowId: string, path: string): boolean {
  const parsed = parseEventSeriesLogoStoragePathFromUrl(path);
  return (
    parsed !== null &&
    idsMatch(parsed.seriesId, rowId) &&
    BUCKET_RELATIVE_STORAGE_LOGO_PATTERN.test(parsed.bucketRelativePath)
  );
}

function isCanonicalVenuePath(rowId: string, path: string): boolean {
  const parsed = parseVenueLogoStoragePathFromUrl(path);
  return (
    parsed !== null &&
    idsMatch(parsed.venueId, rowId) &&
    BUCKET_RELATIVE_STORAGE_LOGO_PATTERN.test(parsed.bucketRelativePath)
  );
}

function isCanonicalCatalogLogoPath(table: LogoSourceTable, rowId: string, path: string): boolean {
  switch (table) {
    case "companies":
      return isCanonicalCompanyPath(rowId, path);
    case "event_series":
      return isCanonicalEventSeriesPath(rowId, path);
    case "venues":
      return isCanonicalVenuePath(rowId, path);
  }
}

function resolveFromStorageBackedUrl(
  table: LogoSourceTable,
  row: LogoUrlRow,
): ResolveCatalogLogoStoragePathResult {
  const plan =
    table === "companies"
      ? planCompanyLogoUrlToRelativePath(row)
      : table === "event_series"
        ? planEventSeriesLogoUrlToRelativePath(row)
        : planVenueLogoUrlToRelativePath(row);

  if (plan.kind === "convert") {
    return { kind: "include", path: plan.after };
  }

  return { kind: "skip", reason: "invalid" };
}

/** Resolve a catalog logo_url to a canonical company-logos object path, or skip. */
export function resolveCatalogLogoStoragePath(
  table: LogoSourceTable,
  row: LogoUrlRow,
): ResolveCatalogLogoStoragePathResult {
  const before = row.logo_url?.trim() ?? "";
  if (!before) {
    return { kind: "skip", reason: "empty" };
  }

  if (isBucketRelativeStorageLogoPath(before)) {
    if (isCanonicalCatalogLogoPath(table, row.id, before)) {
      return { kind: "include", path: before };
    }
    return { kind: "skip", reason: "invalid" };
  }

  if (!isCompanyLogoStorageUrl(before)) {
    return { kind: "skip", reason: "external_url" };
  }

  const bucketRelative = bucketRelativePathFromLogoReference(before);
  if (!bucketRelative || !BUCKET_RELATIVE_STORAGE_LOGO_PATTERN.test(bucketRelative)) {
    return { kind: "skip", reason: "invalid" };
  }

  if (isCanonicalCatalogLogoPath(table, row.id, bucketRelative)) {
    return { kind: "include", path: bucketRelative };
  }

  return resolveFromStorageBackedUrl(table, row);
}
