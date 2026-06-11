"use client";

import { CompanyLogo } from "@/src/components/companies/CompanyLogo";

/** Minimal series shape: `event_series.logo_url` is the only logo source for events. */
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

  return (
    <CompanyLogo
      // domain is intentionally null: series logos must never fall back to Logo.dev.
      company={{
        name,
        logo_url: series?.logo_url ?? null,
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
