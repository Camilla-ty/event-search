import { resolveStorageLogoDisplayUrl } from "@/src/lib/storage/resolveStorageLogoDisplayUrl";

/**
 * Map a stored logo_url (bucket-relative or absolute) to a display-ready public URL
 * before data reaches UI components. Database values stay bucket-relative.
 */
export function mapPublicLogoUrl(
  logoUrl: string | null | undefined,
): string | null {
  return resolveStorageLogoDisplayUrl(logoUrl);
}

/** Map logo_url on a company-like embed row for public/admin display lists. */
export function mapCompanyLogoEmbedForDisplay<
  T extends { logo_url?: string | null },
>(row: T): T {
  if (row.logo_url === undefined) return row;
  return {
    ...row,
    logo_url: mapPublicLogoUrl(row.logo_url),
  };
}

/** Map event_series.logo_url on a raw event_editions embed row. */
export function mapEventEditionSeriesEmbedForDisplay<
  T extends Record<string, unknown>,
>(row: T): T {
  const series = row.event_series;
  if (!series || typeof series !== "object" || Array.isArray(series)) {
    return row;
  }

  const logoUrl = (series as { logo_url?: unknown }).logo_url;
  if (typeof logoUrl !== "string") {
    return row;
  }

  return {
    ...row,
    event_series: {
      ...series,
      logo_url: mapPublicLogoUrl(logoUrl),
    },
  };
}
