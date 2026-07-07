import { isCompanyLogoStorageUrl } from "@/src/lib/companies/isCompanyLogoStorageUrl";
import {
  companyLogoObjectPath,
  parseCompanyLogoStoragePathFromUrl,
} from "@/src/features/companies/server/companyLogoStorage";
import {
  eventSeriesLogoObjectPath,
  parseEventSeriesLogoStoragePathFromUrl,
} from "@/src/features/events/server/eventSeriesLogoStorage";
import {
  parseVenueLogoStoragePathFromUrl,
  venueLogoObjectPath,
} from "@/src/features/venues/server/venueLogoStorage";
import { isBucketRelativeStorageLogoPath } from "@/src/lib/storage/resolveStorageLogoDisplayUrl";

export type LogoUrlRelativeSkipReason =
  | "empty"
  | "already_relative"
  | "external_url"
  | "unparseable_storage_url";

export type LogoUrlRelativePlan =
  | {
      kind: "convert";
      before: string;
      after: string;
    }
  | {
      kind: "skip";
      reason: LogoUrlRelativeSkipReason;
    };

export function isBucketRelativeLogoPath(value: string): boolean {
  return isBucketRelativeStorageLogoPath(value);
}

export function planCompanyLogoUrlToRelativePath(row: {
  id: string;
  logo_url: string | null;
}): LogoUrlRelativePlan {
  const before = row.logo_url?.trim() ?? "";
  if (!before) {
    return { kind: "skip", reason: "empty" };
  }

  if (isBucketRelativeLogoPath(before)) {
    return { kind: "skip", reason: "already_relative" };
  }

  if (!isCompanyLogoStorageUrl(before)) {
    return { kind: "skip", reason: "external_url" };
  }

  const parsed = parseCompanyLogoStoragePathFromUrl(before);
  if (!parsed) {
    return { kind: "skip", reason: "unparseable_storage_url" };
  }

  const after = companyLogoObjectPath(row.id, parsed.extension);
  return { kind: "convert", before, after };
}

export function planEventSeriesLogoUrlToRelativePath(row: {
  id: string;
  logo_url: string | null;
}): LogoUrlRelativePlan {
  const before = row.logo_url?.trim() ?? "";
  if (!before) {
    return { kind: "skip", reason: "empty" };
  }

  if (isBucketRelativeLogoPath(before)) {
    return { kind: "skip", reason: "already_relative" };
  }

  if (!isCompanyLogoStorageUrl(before)) {
    return { kind: "skip", reason: "external_url" };
  }

  const parsed = parseEventSeriesLogoStoragePathFromUrl(before);
  if (!parsed) {
    return { kind: "skip", reason: "unparseable_storage_url" };
  }

  const after = eventSeriesLogoObjectPath(row.id, parsed.extension);
  return { kind: "convert", before, after };
}

export function planVenueLogoUrlToRelativePath(row: {
  id: string;
  logo_url: string | null;
}): LogoUrlRelativePlan {
  const before = row.logo_url?.trim() ?? "";
  if (!before) {
    return { kind: "skip", reason: "empty" };
  }

  if (isBucketRelativeLogoPath(before)) {
    return { kind: "skip", reason: "already_relative" };
  }

  if (!isCompanyLogoStorageUrl(before)) {
    return { kind: "skip", reason: "external_url" };
  }

  const parsed = parseVenueLogoStoragePathFromUrl(before);
  if (!parsed) {
    return { kind: "skip", reason: "unparseable_storage_url" };
  }

  const after = venueLogoObjectPath(row.id, parsed.extension);
  return { kind: "convert", before, after };
}
