import { resolveStorageLogoDisplayUrl } from "@/src/lib/storage/resolveStorageLogoDisplayUrl";

export type SeriesLogoSource = {
  logo_url?: string | null;
};

/**
 * Public display logo for an event edition: series logo only.
 * Edition-level logo_url is ignored (legacy column may still exist in DB).
 */
export function resolveSeriesDisplayLogo(
  series: SeriesLogoSource | null | undefined,
): string | null {
  const seriesLogo = resolveStorageLogoDisplayUrl(series?.logo_url);
  return seriesLogo;
}
