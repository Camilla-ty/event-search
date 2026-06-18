export type EditionLogoSource = {
  logo_url?: string | null;
  event_series?: { logo_url?: string | null } | null;
};

function trimLogoUrl(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

/**
 * Public/admin display logo for an edition:
 * edition.logo_url → event_series.logo_url → null (caller shows placeholder).
 */
export function resolveEditionDisplayLogo(edition: EditionLogoSource): string | null {
  const editionLogo = trimLogoUrl(edition.logo_url);
  if (editionLogo !== "") {
    return editionLogo;
  }

  const seriesLogo = trimLogoUrl(edition.event_series?.logo_url);
  if (seriesLogo !== "") {
    return seriesLogo;
  }

  return null;
}
