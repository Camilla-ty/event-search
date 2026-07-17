import Link from "next/link";

import { Badge } from "@/src/components/common";
import { CompanyLogo } from "@/src/components/companies/CompanyLogo";
import { FactualSummaryParagraph } from "@/src/components/seo/FactualSummaryParagraph";
import { companyLogoFieldsFromRow } from "@/src/lib/companies/companyLogoFields";
import type { SponsorDetailData } from "@/src/features/sponsors/server/types";
import { buildLoginEntryUrl } from "@/src/lib/auth/buildAuthEntryUrl";
import { buildCompanySummary } from "@/src/lib/content/factualSummary";
import { brandLinkClass, secondaryCtaClass } from "@/src/lib/design/classes";
import { formatPublicCompanyWebsite } from "@/src/lib/domain/formatPublicCompanyWebsite";
import { formatLocationFromCityEmbed } from "@/src/lib/location/parseLocationEmbed";
import { buildSponsorProfilePath } from "@/src/lib/routes/explorerUrls";

function formatDateRange(start?: string | null, end?: string | null) {
  if (!start && !end) return "Date TBC";
  if (!start) return end ?? "Date TBC";
  if (!end || end === start) return start;
  return `${start} - ${end}`;
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

function formatSponsoredEditionCount(count: number): string {
  const value = Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
  return `Sponsored ${value.toLocaleString()} ${pluralize(value, "event", "events")}`;
}

function formatTierLabel(tierRank: number | null, tierLabel: string | null): string | null {
  if (tierLabel !== null) return tierLabel;
  if (tierRank !== null) return `Tier ${tierRank}`;
  return null;
}

export function SponsorDetailView({ data }: { data: SponsorDetailData }) {
  const { company, isAuthenticated, summary, eventSeriesGroups } = data;
  const locationLabel = formatLocationFromCityEmbed(company.cities);
  const websiteDisplay = formatPublicCompanyWebsite({
    website: company.website,
    domain: company.domain,
  });
  const profilePath = buildSponsorProfilePath(company);
  const loginHref =
    profilePath !== null ? buildLoginEntryUrl(profilePath) : buildLoginEntryUrl("/sponsors");
  const hasSponsorships = summary.sponsoredEditionCount > 0;
  const companyName =
    typeof company.name === "string" && company.name.trim() !== ""
      ? company.name.trim()
      : "Company profile";
  const factualSummary = buildCompanySummary({
    name: companyName,
    website: company.website,
    domain: company.domain,
    sponsoredEditionCount: summary.sponsoredEditionCount,
    sponsoredEditionCountUnknown: summary.sponsoredEditionCountUnknown === true,
  });

  return (
    <section className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <Link href="/sponsors" className={`text-sm ${brandLinkClass}`}>
          ← Back to Sponsors
        </Link>
      </div>

      <header className="grid gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-[auto_1fr] md:items-start">
        <CompanyLogo
          company={companyLogoFieldsFromRow(company)}
          className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
        />

        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">Sponsor</Badge>
            {company.industry ? <Badge variant="success">{company.industry}</Badge> : null}
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">{companyName}</h1>
          {factualSummary ? (
            <FactualSummaryParagraph summary={factualSummary} />
          ) : null}
          {company.short_description ? (
            <p className="text-sm text-slate-600">{company.short_description}</p>
          ) : null}
          <dl className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
            {locationLabel ? (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Location
                </dt>
                <dd>{locationLabel}</dd>
              </div>
            ) : null}
            {websiteDisplay ? (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Website
                </dt>
                <dd>
                  <a
                    href={websiteDisplay.href}
                    target="_blank"
                    rel="noreferrer"
                    className={brandLinkClass}
                  >
                    {websiteDisplay.label}
                  </a>
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      </header>

      {company.description && company.description.trim() !== "" ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">About</h2>
          <p className="mt-2 text-sm text-slate-600">{company.description.trim()}</p>
        </section>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Sponsorship history</h2>

        {!isAuthenticated ? (
          <div className="mt-4 space-y-4">
            {hasSponsorships ? (
              <p className="text-sm font-medium text-slate-900">
                {formatSponsoredEditionCount(summary.sponsoredEditionCount)}
              </p>
            ) : (
              <p className="text-sm text-slate-500">No sponsorship history recorded yet.</p>
            )}
            {hasSponsorships ? (
              <Link href={loginHref} className={`${secondaryCtaClass} inline-flex h-10 px-4`}>
                Sign in to view full sponsorship history
              </Link>
            ) : null}
          </div>
        ) : eventSeriesGroups.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No sponsorship history recorded yet.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {eventSeriesGroups.map((group) => {
              const editionCount = group.editions.length;
              return (
                <li key={group.series.id}>
                  <details className="group rounded-lg border border-slate-200 open:bg-slate-50">
                    <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm text-slate-900">
                      <span className="font-medium">{group.series.name}</span>
                      <span className="text-xs font-normal text-slate-500">
                        {editionCount} {pluralize(editionCount, "edition", "editions")}
                      </span>
                    </summary>

                    <ul className="divide-y divide-slate-100 border-t border-slate-200">
                      {group.editions.map((entry) => {
                        const edition = entry.edition;
                        const hrefId = edition.slug ?? edition.id;
                        const year =
                          typeof edition.year === "number" ? edition.year : null;
                        const dateRange = formatDateRange(
                          edition.start_date,
                          edition.end_date,
                        );
                        const hasUsableDateRange =
                          dateRange !== "" && dateRange !== "Date TBC";
                        const metaParts: string[] = [];
                        if (year !== null) metaParts.push(String(year));
                        if (hasUsableDateRange) metaParts.push(dateRange);
                        const tierDisplay = formatTierLabel(
                          entry.tierRank,
                          entry.tierLabel,
                        );

                        return (
                          <li
                            key={String(edition.id)}
                            className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="min-w-0 space-y-1">
                              <p className="font-medium text-slate-900">
                                {edition.name ?? "Untitled event"}
                              </p>
                              {metaParts.length > 0 ? (
                                <p className="text-xs text-slate-500">
                                  {metaParts.join(" · ")}
                                </p>
                              ) : null}
                              {tierDisplay ? (
                                <Badge variant="success">{tierDisplay}</Badge>
                              ) : null}
                            </div>
                            <Link
                              href={`/events/${encodeURIComponent(String(hrefId))}`}
                              className={`${secondaryCtaClass} h-9 shrink-0 px-4`}
                            >
                              View event
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </section>
  );
}
