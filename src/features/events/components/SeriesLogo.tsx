"use client";

import { CompanyLogo } from "@/src/components/companies/CompanyLogo";

/** Minimal series shape. Event logos are manual-only; `event_series.logo_url` is the logo source. */
export type SeriesLogoSource = {
  name?: string | null;
  logo_url?: string | null;
};

type SeriesLogoProps = {
  series: SeriesLogoSource | null | undefined;
  /** Monogram source when the edition has no linked series (e.g. the edition name). */
  fallbackName?: string | null;
  className?: string;
  imageClassName?: string;
  monogramClassName?: string;
};

export function SeriesLogo({
  series,
  fallbackName,
  className,
  imageClassName,
  monogramClassName,
}: SeriesLogoProps) {
  const name = series?.name?.trim() || fallbackName?.trim() || null;
  const resolvedLogoUrl = series?.logo_url ?? null;

  return (
    <CompanyLogo
      // domain is intentionally null: event logos are manual-only (no Logo.dev fallback).
      company={{
        name,
        logo_url: resolvedLogoUrl,
        domain: null,
        logo_source: null,
        logo_status: null,
      }}
      alt={name ? `${name} logo` : "Event logo"}
      className={className}
      imageClassName={imageClassName}
      monogramClassName={monogramClassName}
    />
  );
}
