import Link from "next/link";

import { CompanyLogo } from "@/src/components/companies/CompanyLogo";
import { FactualSummaryParagraph } from "@/src/components/seo/FactualSummaryParagraph";
import type { BitcoinAsiaHubPageData } from "@/src/features/events/server/bitcoinAsiaHubPublic";
import {
  brandLinkClass,
  secondaryCtaClass,
} from "@/src/lib/design/classes";
import {
  buildEventDetailPath,
  buildSeriesHubPath,
  buildSponsorProfilePath,
} from "@/src/lib/routes/explorerUrls";

type BitcoinAsiaHubViewProps = {
  data: BitcoinAsiaHubPageData;
};

export function BitcoinAsiaHubView({ data }: BitcoinAsiaHubViewProps) {
  return (
    <section className="mx-auto max-w-6xl space-y-8">
      <nav aria-label="Breadcrumb" className="text-sm text-slate-600">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/events" className={brandLinkClass}>
              Events
            </Link>
          </li>
          <li aria-hidden="true" className="text-slate-400">
            ›
          </li>
          <li>
            <Link href={data.topicHubPath} className={brandLinkClass}>
              Bitcoin
            </Link>
          </li>
          <li aria-hidden="true" className="text-slate-400">
            ›
          </li>
          <li className="font-medium text-slate-900">Asia</li>
        </ol>
      </nav>

      <header className="space-y-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Bitcoin · Asia
        </p>
        <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">{data.h1}</h1>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <FactualSummaryParagraph
            summary={data.summary}
            className="text-sm leading-relaxed text-slate-700 sm:text-[15px]"
          />
          {data.lastReviewedLabel ? (
            <p className="mt-4 text-sm text-slate-500">
              Last reviewed {data.lastReviewedLabel}
            </p>
          ) : null}
        </div>
      </header>

      <section aria-labelledby="bitcoin-asia-events-heading" className="space-y-4">
        <h2
          id="bitcoin-asia-events-heading"
          className="text-lg font-semibold text-slate-900"
        >
          Events ({data.events.length})
        </h2>

        <ul className="space-y-3">
          {data.events.map((event) => {
            const eventHref = buildEventDetailPath(event);
            const seriesHref =
              event.seriesSlug !== null
                ? buildSeriesHubPath({ slug: event.seriesSlug })
                : null;

            return (
              <li
                key={event.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1.5">
                    {eventHref ? (
                      <Link
                        href={eventHref}
                        className="text-base font-semibold text-slate-900 hover:text-brand-primary"
                      >
                        {event.name}
                      </Link>
                    ) : (
                      <p className="text-base font-semibold text-slate-900">{event.name}</p>
                    )}
                    <p className="text-sm text-slate-600">
                      {[event.dateLabel, event.locationLabel]
                        .filter((part) => part && part.trim() !== "")
                        .join(" · ")}
                    </p>
                    {event.seriesName ? (
                      <p className="text-sm text-slate-600">
                        Event brand:{" "}
                        {seriesHref ? (
                          <Link href={seriesHref} className={brandLinkClass}>
                            {event.seriesName}
                          </Link>
                        ) : (
                          event.seriesName
                        )}
                      </p>
                    ) : null}
                    <p className="text-sm text-slate-600">
                      {event.sponsorCount > 0
                        ? `${event.sponsorCount} sponsors recorded`
                        : "Sponsors recorded: —"}
                      {event.lastReviewedLabel
                        ? ` · Last reviewed ${event.lastReviewedLabel}`
                        : ""}
                    </p>
                  </div>
                  {eventHref ? (
                    <Link
                      href={eventHref}
                      className={`${secondaryCtaClass} h-9 w-full shrink-0 px-4 sm:w-auto`}
                    >
                      View event →
                    </Link>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>

        <p>
          <Link href={data.topicHubPath} className={`text-sm ${brandLinkClass}`}>
            View all Bitcoin events →
          </Link>
        </p>
      </section>

      <section
        id="sponsors"
        aria-labelledby="bitcoin-asia-sponsors-heading"
        className="space-y-4"
      >
        <div className="space-y-1">
          <h2
            id="bitcoin-asia-sponsors-heading"
            className="text-lg font-semibold text-slate-900"
          >
            Sponsors on these Bitcoin events
          </h2>
          <p className="text-sm font-medium text-slate-700">
            {data.totalSponsorCount} companies recorded as sponsors of the Bitcoin
            events listed above.
          </p>
        </div>

        <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Website</th>
                <th className="px-4 py-3 text-right">Bitcoin events in Asia</th>
                <th className="px-4 py-3 text-right">Total recorded</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.sponsors.map((sponsor) => {
                const href = buildSponsorProfilePath(sponsor);
                return (
                  <tr key={sponsor.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <CompanyLogo
                          company={{
                            name: sponsor.name,
                            logo_url: sponsor.logoUrl,
                            domain: sponsor.domain,
                          }}
                          className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50"
                          monogramClassName="text-xs font-semibold text-slate-400"
                        />
                        {href ? (
                          <Link href={href} className={`font-medium ${brandLinkClass}`}>
                            {sponsor.name}
                          </Link>
                        ) : (
                          <span className="font-medium text-slate-900">{sponsor.name}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{sponsor.domain ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-900">
                      {sponsor.hubEventCount}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-900">
                      {sponsor.globalEditionCount}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <ul className="space-y-3 md:hidden">
          {data.sponsors.map((sponsor) => {
            const href = buildSponsorProfilePath(sponsor);
            return (
              <li
                key={sponsor.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <CompanyLogo
                    company={{
                      name: sponsor.name,
                      logo_url: sponsor.logoUrl,
                      domain: sponsor.domain,
                    }}
                    className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50"
                    monogramClassName="text-sm font-semibold text-slate-400"
                  />
                  <div className="min-w-0 space-y-1">
                    {href ? (
                      <Link href={href} className={`font-semibold ${brandLinkClass}`}>
                        {sponsor.name}
                      </Link>
                    ) : (
                      <p className="font-semibold text-slate-900">{sponsor.name}</p>
                    )}
                    <p className="text-sm text-slate-600">{sponsor.domain ?? "—"}</p>
                    <p className="text-sm text-slate-600">
                      Bitcoin events in Asia: {sponsor.hubEventCount}
                    </p>
                    <p className="text-sm text-slate-600">
                      Total recorded: {sponsor.globalEditionCount}
                    </p>
                    {href ? (
                      <Link href={href} className={`inline-block pt-1 text-sm ${brandLinkClass}`}>
                        View profile →
                      </Link>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="space-y-1 text-sm text-slate-600">
          <p>
            Showing {data.sponsors.length} of {data.totalSponsorCount} companies.
          </p>
          <p>Browse sponsor profiles for companies recorded on these events.</p>
          <p>
            <Link href="/sponsors" className={brandLinkClass}>
              Sponsor discovery →
            </Link>
          </p>
        </div>
      </section>

      <p className="text-xs text-slate-500">
        Counts reflect EventPixels-recorded sponsorship data.
      </p>
    </section>
  );
}
