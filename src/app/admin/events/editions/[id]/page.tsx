import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AdminBreadcrumbs } from "@/src/features/admin/components/AdminBreadcrumbs";
import { AdminPageHeader } from "@/src/features/admin/components/AdminPageHeader";
import { EventsSubNav } from "@/src/features/admin/components/EventsSubNav";
import { getCityOptions } from "@/src/features/companies/server/getCityOptions";
import { getCompaniesByEventEdition } from "@/src/lib/queries/companies";
import { EditionDetailTabs } from "@/src/features/events/components/admin/EditionDetailTabs";
import { EditionImportsStub } from "@/src/features/events/components/admin/EditionImportsStub";
import { EditionLiveSponsorsTable } from "@/src/features/events/components/admin/EditionLiveSponsorsTable";
import { EventEditionForm } from "@/src/features/events/components/admin/EventEditionForm";
import {
  countLiveSponsorsForEdition,
  getEventEditionAdminById,
} from "@/src/features/events/server/eventEditionAdmin";
import { getSeriesOptions } from "@/src/features/events/server/getSeriesOptions";
import { primaryCtaClass } from "@/src/lib/design/classes";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

function editionProfileWarnings(edition: {
  website_url: string | null;
  start_date: string | null;
  end_date: string | null;
  city_id: string | null;
}): string[] {
  const messages: string[] = [];
  if (!edition.website_url) {
    messages.push("Website is strongly recommended for sponsor research.");
  }
  if (!edition.start_date && !edition.end_date) {
    messages.push("Dates help users find this event.");
  }
  if (!edition.city_id) {
    messages.push("City improves event discovery and filtering.");
  }
  return messages;
}

export default async function AdminEventEditionDetailPage({ params }: PageProps) {
  const { id } = await params;
  const edition = await getEventEditionAdminById(id);
  if (!edition) notFound();

  const [cities, series, liveSponsorCount, sponsors] = await Promise.all([
    getCityOptions(),
    getSeriesOptions(),
    countLiveSponsorsForEdition(id),
    getCompaniesByEventEdition(id),
  ]);

  const sponsorRows = sponsors.map((row) => ({
    id: String(row.id),
    tier_rank: typeof row.tier_rank === "number" ? row.tier_rank : null,
    companies:
      row.companies && typeof row.companies === "object"
        ? {
            id: String(row.companies.id),
            name: typeof row.companies.name === "string" ? row.companies.name : null,
            slug: typeof row.companies.slug === "string" ? row.companies.slug : null,
            domain: typeof row.companies.domain === "string" ? row.companies.domain : null,
          }
        : null,
  }));

  return (
    <section>
      <AdminBreadcrumbs
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Events", href: "/admin/events" },
          { label: "Editions", href: "/admin/events/editions" },
          { label: edition.name },
        ]}
      />
      <AdminPageHeader
        title={`${edition.name} (${edition.year})`}
        description={edition.event_series?.name ?? "Event edition"}
        actions={
          <Link
            href={`/admin/sponsor-imports/new?editionId=${edition.id}`}
            className={`${primaryCtaClass} h-10`}
          >
            Import sponsors
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3 text-sm text-slate-600">
        {edition.cities?.name ? <span>City: {edition.cities.name}</span> : null}
        <span>
          Slug:{" "}
          <Link href={`/events/${edition.slug}`} className="font-mono text-brand-primary hover:underline">
            {edition.slug}
          </Link>
        </span>
        <span>Live sponsors: {liveSponsorCount}</span>
      </div>

      <EventsSubNav />

      <Suspense fallback={<p className="text-sm text-slate-500">Loading…</p>}>
        <EditionDetailTabs
          editionId={edition.id}
          profileWarnings={editionProfileWarnings(edition)}
          profilePanel={
            <EventEditionForm
              mode="edit"
              editionId={edition.id}
              series={series}
              cities={cities}
              readOnlySeriesName={edition.event_series?.name}
              readOnlyYear={edition.year}
              initial={{
                series_id: edition.series_id ?? "",
                year: String(edition.year),
                name: edition.name,
                slug: edition.slug,
                website_url: edition.website_url ?? "",
                start_date: edition.start_date ?? "",
                end_date: edition.end_date ?? "",
                city_id: edition.city_id ?? "",
              }}
            />
          }
          sponsorsPanel={<EditionLiveSponsorsTable sponsors={sponsorRows} />}
          importsPanel={
            <EditionImportsStub
              editionName={edition.name}
              seriesName={edition.event_series?.name ?? "—"}
              liveSponsorCount={liveSponsorCount}
            />
          }
        />
      </Suspense>
    </section>
  );
}
