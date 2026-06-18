import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AdminBreadcrumbs } from "@/src/features/admin/components/AdminBreadcrumbs";
import { AdminPageHeader } from "@/src/features/admin/components/AdminPageHeader";
import { EventsSubNav } from "@/src/features/admin/components/EventsSubNav";
import { getCityOptions } from "@/src/features/companies/server/getCityOptions";
import { EditionDetailTabs } from "@/src/features/events/components/admin/EditionDetailTabs";
import { EditionImportsPanel } from "@/src/features/sponsor-import/components/EditionImportsPanel";
import { defaultStepForBatchStatus, flowHref } from "@/src/features/sponsor-import/client/resumeStep";
import type { SponsorImportBatchStatus } from "@/src/features/sponsor-import/types";
import { getEditionImportsData } from "@/src/features/sponsor-import/server/importUiData";
import {
  EditionSponsorsPanel,
  type ActiveImportInfo,
} from "@/src/features/events/components/admin/EditionSponsorsPanel";
import { EventEditionForm } from "@/src/features/events/components/admin/EventEditionForm";
import { SeriesKeywordsChips } from "@/src/features/events/components/admin/SeriesKeywordsChips";
import { getInheritedKeywordsForEditionId } from "@/src/features/events/server/seriesKeywordsAdmin";
import {
  countLiveSponsorsForEdition,
  getEventEditionAdminById,
  getLiveSponsorsForEditionAdmin,
} from "@/src/features/events/server/eventEditionAdmin";
import { getSeriesOptions } from "@/src/features/events/server/getSeriesOptions";
import { primaryCtaClass } from "@/src/lib/design/classes";
import { formatLocationFromCityEmbed } from "@/src/lib/location/parseLocationEmbed";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

const ACTIVE_BATCH_STATUSES: readonly SponsorImportBatchStatus[] = [
  "uploaded",
  "review",
  "draft",
];

function parseActiveBatchStatus(raw: string | null): SponsorImportBatchStatus | null {
  if (raw === null) return null;
  const match = ACTIVE_BATCH_STATUSES.find((status) => status === raw);
  return match ?? null;
}

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

  const editionLocationLabel = formatLocationFromCityEmbed(edition.cities);

  const [cities, series, liveSponsorCount, sponsors, importsData, inheritedKeywords] =
    await Promise.all([
      getCityOptions(),
      getSeriesOptions(),
      countLiveSponsorsForEdition(id),
      getLiveSponsorsForEditionAdmin(id),
      getEditionImportsData(
        id,
        edition.name,
        edition.event_series?.name ?? "—",
        0,
      ),
      getInheritedKeywordsForEditionId(id),
    ]);

  importsData.liveSponsorCount = liveSponsorCount;

  const activeBatch = importsData.activeBatch;
  const activeBatchId =
    activeBatch && typeof activeBatch.id === "string" ? activeBatch.id : null;
  const activeBatchStatus =
    activeBatch && typeof activeBatch.status === "string" ? activeBatch.status : null;

  const parsedActiveStatus = parseActiveBatchStatus(activeBatchStatus);
  const activeImport: ActiveImportInfo | null =
    activeBatchId && parsedActiveStatus
      ? { batchId: activeBatchId, status: parsedActiveStatus }
      : null;

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
        description={
          edition.event_series?.id && edition.event_series.name ? (
            <Link
              href={`/admin/events/series/${edition.event_series.id}`}
              className="text-brand-primary hover:underline"
            >
              {edition.event_series.name}
            </Link>
          ) : (
            (edition.event_series?.name ?? "Event edition")
          )
        }
        actions={
          activeImport ? (
            <Link
              href={flowHref(
                activeImport.batchId,
                defaultStepForBatchStatus(activeImport.status),
              )}
              className={`${primaryCtaClass} h-10`}
            >
              Resume import
            </Link>
          ) : (
            <Link
              href={`/admin/sponsor-imports/new?editionId=${edition.id}`}
              className={`${primaryCtaClass} h-10`}
            >
              Import sponsors
            </Link>
          )
        }
      />

      <div className="mb-4 flex flex-wrap gap-3 text-sm text-slate-600">
        {editionLocationLabel ? <span>Location: {editionLocationLabel}</span> : null}
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
            <div className="space-y-6">
              <SeriesKeywordsChips keywords={inheritedKeywords} />
              <EventEditionForm
                mode="edit"
                editionId={edition.id}
                series={series}
                cities={cities}
                readOnlySeriesName={edition.event_series?.name}
                readOnlySeriesId={edition.event_series?.id ?? edition.series_id ?? undefined}
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
            </div>
          }
          sponsorsPanel={
            <EditionSponsorsPanel
              editionId={edition.id}
              editionName={edition.name}
              editionYear={edition.year}
              editionSlug={edition.slug}
              eventWebsiteUrl={edition.website_url}
              sponsors={sponsors}
              activeImport={activeImport}
            />
          }
          importsPanel={<EditionImportsPanel data={importsData} />}
        />
      </Suspense>
    </section>
  );
}
