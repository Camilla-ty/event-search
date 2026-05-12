import Link from "next/link";

import { Badge } from "@/src/components/common";

import type { SponsorDetailData } from "@/src/features/sponsors/server/types";

function formatDateRange(start?: string | null, end?: string | null) {
  if (!start && !end) return "Date TBC";
  if (!start) return end ?? "Date TBC";
  if (!end || end === start) return start;
  return `${start} - ${end}`;
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

export function SponsorDetailView({ data }: { data: SponsorDetailData }) {
  const { company, eventSeriesGroups } = data;
  const locationLabel = [company.cities?.name, company.cities?.countries?.name]
    .filter(Boolean)
    .join(", ");
  const website = company.website?.trim() ?? "";
  const logoUrl = company.logo_url?.trim() ?? "";

  return (
    <section className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/sponsors"
          className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
        >
          ← Back to Sponsors
        </Link>
      </div>

      <header className="grid gap-6 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-[auto_1fr] md:items-start">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={company.name ? `${company.name} logo` : "Company logo"}
              className="h-full w-full object-contain"
            />
          ) : (
            <span className="text-2xl font-semibold text-slate-400 dark:text-slate-500">
              {(company.name ?? "?").slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>

        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">Sponsor</Badge>
            {company.industry ? (
              <Badge variant="success">{company.industry}</Badge>
            ) : null}
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {typeof company.name === "string" && company.name.trim() !== ""
              ? company.name.trim()
              : "Company profile"}
          </h1>
          {company.short_description ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {company.short_description}
            </p>
          ) : null}
          <dl className="grid gap-2 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-2">
            {locationLabel ? (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Location
                </dt>
                <dd>{locationLabel}</dd>
              </div>
            ) : null}
            {website ? (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Website
                </dt>
                <dd>
                  <a
                    href={website.startsWith("http") ? website : `https://${website}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-violet-600 hover:text-violet-500 dark:text-violet-400"
                  >
                    {website.replace(/^https?:\/\//, "")}
                  </a>
                </dd>
              </div>
            ) : null}
            {company.domain ? (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Domain
                </dt>
                <dd className="font-mono text-xs">{company.domain}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      </header>

      {company.description && company.description.trim() !== "" ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">About</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{company.description.trim()}</p>
        </section>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Sponsored Events
        </h2>

        {eventSeriesGroups.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            No linked events yet. Sponsor links come from{" "}
            <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">
              event_sponsors
            </code>{" "}
            for this company.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {eventSeriesGroups.map((group) => {
              const editionCount = group.editions.length;
              return (
                <li key={group.series.id}>
                  <details className="group rounded-lg border border-slate-200 open:bg-slate-50 dark:border-slate-800 dark:open:bg-slate-900/60">
                    <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                      <span className="font-medium">{group.series.name}</span>
                      <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                        {editionCount}{" "}
                        {pluralize(editionCount, "edition", "editions")}
                      </span>
                    </summary>

                    <ul className="divide-y divide-slate-100 border-t border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                      {group.editions.map((edition) => {
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
                        return (
                          <li
                            key={String(edition.id)}
                            className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900 dark:text-slate-100">
                                {edition.name ?? "Untitled event"}
                              </p>
                              {metaParts.length > 0 ? (
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  {metaParts.join(" · ")}
                                </p>
                              ) : null}
                            </div>
                            <Link
                              href={`/events/${encodeURIComponent(String(hrefId))}`}
                              className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
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
