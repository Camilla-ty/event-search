import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/src/components/common";
import { getEventDetailData } from "@/src/features/events/server/getEventDetailData";

export const dynamic = "force-dynamic";

type EventDetailPageProps = {
  params: Promise<{ id: string }>;
};

function formatDateRange(start?: string | null, end?: string | null) {
  if (!start && !end) return "Date TBC";
  if (!start) return end ?? "Date TBC";
  if (!end || end === start) return start;
  return `${start} - ${end}`;
}

type RelatedCompany = {
  id?: string | null;
  slug?: string | null;
  name?: string | null;
  website?: string | null;
  logo_url?: string | null;
  short_description?: string | null;
  description?: string | null;
  city_id?: string | null;
  cities?: {
    name?: string | null;
    countries?: { name?: string | null } | null;
  } | null;
};

type RelatedSponsor = {
  id: string | number;
  company_id?: string | null;
  tier_rank?: number | null;
  companies?: RelatedCompany | null;
};

function sponsorDetailHref(companyId: string): string {
  return `/sponsors/${encodeURIComponent(companyId)}`;
}

function normalizeDisplayName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed !== "" ? trimmed : null;
}

function companyNameFromSponsor(sponsor: RelatedSponsor): string | null {
  const company = sponsor.companies as
    | RelatedCompany
    | RelatedCompany[]
    | null
    | undefined;

  if (Array.isArray(company)) {
    const first = company[0];
    return normalizeDisplayName(first?.name);
  }
  return normalizeDisplayName(company?.name);
}

function companySlugFromSponsor(sponsor: RelatedSponsor): string | null {
  const company = sponsor.companies as
    | RelatedCompany
    | RelatedCompany[]
    | null
    | undefined;

  if (Array.isArray(company)) {
    const first = company[0];
    return normalizeDisplayName(first?.slug);
  }
  return normalizeDisplayName(company?.slug);
}

/** Prefer FK on the link row so rows still render if `companies` is null (e.g. RLS) or name is empty. */
function effectiveCompanyId(sponsor: RelatedSponsor): string | null {
  const fk = sponsor.company_id;
  if (fk !== null && fk !== undefined && String(fk).trim() !== "") {
    return String(fk).trim();
  }
  const merged = sponsor.companies?.id;
  if (merged !== null && merged !== undefined && String(merged).trim() !== "") {
    return String(merged).trim();
  }
  return null;
}

/** `{company.name}` or `{company.name} Tier {tier_rank}` — no tier segment when `tier_rank` is null. */
function relatedSponsorListLabel(
  sponsor: RelatedSponsor,
): string {
  const name = companyNameFromSponsor(sponsor);
  if (name) return name;
  return "Company";
}

function sponsorRouteSegment(sponsor: RelatedSponsor): string | null {
  const slug = companySlugFromSponsor(sponsor);
  if (slug) return slug;
  return effectiveCompanyId(sponsor);
}

function isDisplayableSponsor(sponsor: RelatedSponsor): boolean {
  return effectiveCompanyId(sponsor) !== null;
}

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const { id } = await params;
  const edition = await getEventDetailData(id);

  if (!edition) {
    notFound();
  }

  const sponsors = (edition.event_sponsors ?? []) as RelatedSponsor[];

  const relatedSponsors = sponsors.filter(isDisplayableSponsor);

  const sponsorCount = relatedSponsors.length;

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/events"
          className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
        >
          ← Back to Events Explorer
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-200 dark:border-slate-800 dark:bg-slate-800">
          <div className="aspect-[16/9] w-full bg-gradient-to-br from-violet-700 to-indigo-500" />
        </div>

        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="space-y-2">
            <Badge variant="neutral">{edition.event_series?.name ?? "Event"}</Badge>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{edition.name}</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {edition.cities?.name ?? "Unknown city"}
              {edition.cities?.countries?.name ? `, ${edition.cities.countries.name}` : ""}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {formatDateRange(edition.start_date, edition.end_date)}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
              <p className="text-xs text-slate-500 dark:text-slate-400">Sponsors</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{sponsorCount}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
              <p className="text-xs text-slate-500 dark:text-slate-400">Year</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{edition.year ?? "TBC"}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
              <p className="text-xs text-slate-500 dark:text-slate-400">Category</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {edition.event_series?.name ?? "General"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Description</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {edition.event_series?.description ??
            "Detailed event description will be expanded as the content model evolves."}
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Related Sponsors</h2>
            <Link
              href="/sponsors"
              className="text-sm font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400"
            >
              View all
            </Link>
          </div>

          {relatedSponsors.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No sponsors linked to this event yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {relatedSponsors.map((sponsor) => {
                const segment = sponsorRouteSegment(sponsor);
                if (!segment) {
                  return null;
                }
                const company = sponsor.companies;
                const heading = relatedSponsorListLabel(sponsor);

                const href = sponsorDetailHref(segment);

                const logoRaw = company?.logo_url?.trim();
                const shortRaw = company?.short_description?.trim();

                return (
                  <li key={String(sponsor.id)}>
                    <Link
                      href={href}
                      className="block rounded-lg border border-slate-200 p-3 transition hover:border-violet-300 hover:bg-slate-50 dark:border-slate-800 dark:hover:border-violet-700 dark:hover:bg-slate-800/80"
                    >
                      <div className="flex gap-3">
                        {logoRaw ? (
                          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
                            <img
                              src={logoRaw}
                              alt=""
                              className="h-full w-full object-contain"
                            />
                          </div>
                        ) : null}
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <p className="font-semibold text-slate-900 dark:text-slate-100">{heading}</p>
                            {sponsor.tier_rank != null ? (
                              <span className="shrink-0 text-xs font-medium text-slate-500 dark:text-slate-400">
                                Tier {sponsor.tier_rank}
                              </span>
                            ) : null}
                          </div>
                          {shortRaw ? (
                            <p className="line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{shortRaw}</p>
                          ) : null}
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Actions</h2>
          <div className="mt-3 space-y-2">
            <Link
              href={`/sponsors?event=${edition.slug ?? ""}`}
              className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-violet-600 px-4 text-sm font-medium text-white hover:bg-violet-500"
            >
              View Sponsors
            </Link>
            <Link
              href="/events"
              className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              Back to Explorer
            </Link>
          </div>
        </div>
      </section>
    </section>
  );
}
