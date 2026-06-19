export type SeriesLogoSource = {
  logo_url?: string | null;
};

function trimLogoUrl(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

/**
 * Public display logo for an event edition: series logo only.
 * Edition-level logo_url is ignored (legacy column may still exist in DB).
 */
export function resolveSeriesDisplayLogo(
  series: SeriesLogoSource | null | undefined,
): string | null {
  const seriesLogo = trimLogoUrl(series?.logo_url);
  return seriesLogo !== "" ? seriesLogo : null;
}
