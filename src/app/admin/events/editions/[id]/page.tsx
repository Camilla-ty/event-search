import Link from "next/link";
import { notFound } from "next/navigation";

import { InlineErrorBanner } from "@/src/components/common";
import { AdminBreadcrumbs } from "@/src/features/admin/components/AdminBreadcrumbs";
import { AdminPageHeader } from "@/src/features/admin/components/AdminPageHeader";
import { EventsSubNav } from "@/src/features/admin/components/EventsSubNav";
import { EditionDetailTabs } from "@/src/features/events/components/admin/EditionDetailTabs";
import { parseAdminEditionTab } from "@/src/features/events/components/admin/adminEditionTabUrls";
import { EditionOrganizersPanel } from "@/src/features/organizers/components/admin/EditionOrganizersPanel";
import { EditionImportsPanel } from "@/src/features/sponsor-import/components/EditionImportsPanel";
import { defaultStepForBatchStatus, flowHref } from "@/src/features/sponsor-import/client/resumeStep";
import type { SponsorImportBatchStatus } from "@/src/features/sponsor-import/types";
import {
  EditionSponsorsPanel,
  type ActiveImportInfo,
} from "@/src/features/events/components/admin/EditionSponsorsPanel";
import {
  EditionLiveSponsorCountLabel,
  EditionLiveSponsorCountProvider,
} from "@/src/features/events/components/admin/EditionLiveSponsorCountContext";
import { EventEditionForm } from "@/src/features/events/components/admin/EventEditionForm";
import { buildEditionFormInitialValues } from "@/src/features/events/components/admin/editionFormValues";
import { SeriesKeywordsChips } from "@/src/features/events/components/admin/SeriesKeywordsChips";
import {
  adminEditionPanelErrorMessage,
  loadAdminEditionOptionalPanels,
  loadAdminEditionRequired,
  summarizeAdminEditionPanelErrors,
} from "@/src/features/events/server/eventEditionAdminPageLoad";
import { brandLinkClass, primaryCtaClass } from "@/src/lib/design/classes";
import { formatLocationFromCityEmbed } from "@/src/lib/location/parseLocationEmbed";
import { parseSponsorNoteType } from "@/src/features/events/lib/sponsorNoteType";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
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

export default async function AdminEventEditionDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { tab: requestedTab } = await searchParams;
  const required = await loadAdminEditionRequired(id);

  if (required.loadError) {
    return (
      <section>
        <AdminBreadcrumbs
          items={[
            { label: "Admin", href: "/admin" },
            { label: "Events", href: "/admin/events" },
            { label: "Editions", href: "/admin/events/editions" },
            { label: "Edition unavailable" },
          ]}
        />
        <AdminPageHeader
          title="Edition unavailable"
          description="This edition could not be loaded from the database."
        />
        <EventsSubNav />
        <InlineErrorBanner
          message={`Could not load this edition: ${required.loadError}. Refresh the page to try again.`}
        />
        <p className="mt-4 text-sm text-slate-600">
          <Link href="/admin/events/editions" className={brandLinkClass}>
            ← Back to editions
          </Link>
        </p>
      </section>
    );
  }

  const edition = required.edition;
  if (!edition) notFound();

  const panels = await loadAdminEditionOptionalPanels(edition);
  const panelErrorSummary = summarizeAdminEditionPanelErrors(panels.panelErrors);

  const editionLocationLabel = formatLocationFromCityEmbed(edition.cities);
  const sponsorNoteType = parseSponsorNoteType(edition.sponsor_note_type);

  const importsData = panels.importsData;
  importsData.liveSponsorCount = panels.liveSponsorCount;

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

  const sponsorsPanelError = adminEditionPanelErrorMessage(panels.panelErrors, "sponsors");
  const organizersPanelError = adminEditionPanelErrorMessage(panels.panelErrors, "organizers");
  const importsPanelError = adminEditionPanelErrorMessage(panels.panelErrors, "imports");
  const profilePanelError =
    adminEditionPanelErrorMessage(panels.panelErrors, "cities") ??
    adminEditionPanelErrorMessage(panels.panelErrors, "series") ??
    adminEditionPanelErrorMessage(panels.panelErrors, "keywords");
  const initialTab = parseAdminEditionTab(requestedTab ?? null);

  return (
    <EditionLiveSponsorCountProvider initialCount={panels.liveSponsorCount}>
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
        {edition.venues?.name ? (
          <span>
            Venue:{" "}
            <Link href={`/admin/venues/${edition.venues.id}`} className="text-brand-primary hover:underline">
              {edition.venues.name}
              {edition.venues.archived_at ? " (archived)" : ""}
            </Link>
          </span>
        ) : null}
        <span>
          Slug:{" "}
          <Link href={`/events/${edition.slug}`} className="font-mono text-brand-primary hover:underline">
            {edition.slug}
          </Link>
        </span>
        <span>
          <EditionLiveSponsorCountLabel />
        </span>
      </div>

      <EventsSubNav />

      {panelErrorSummary ? (
        <InlineErrorBanner
          className="mb-4"
          message={`Some edition panels failed to load (${panelErrorSummary}). Refresh the page to try again.`}
        />
      ) : null}

      <EditionDetailTabs
          editionId={edition.id}
          initialTab={initialTab}
          profileWarnings={editionProfileWarnings(edition)}
          profilePanel={
            <div className="space-y-6">
              {profilePanelError ? (
                <InlineErrorBanner message={`Profile data unavailable: ${profilePanelError}`} />
              ) : null}
              <SeriesKeywordsChips keywords={panels.inheritedKeywords} />
              <EventEditionForm
                mode="edit"
                editionId={edition.id}
                series={panels.series}
                cities={panels.cities}
                readOnlySeriesName={edition.event_series?.name}
                readOnlySeriesId={edition.event_series?.id ?? edition.series_id ?? undefined}
                readOnlyYear={edition.year}
                initial={buildEditionFormInitialValues({
                  series_id: edition.series_id ?? "",
                  year: edition.year,
                  name: edition.name,
                  slug: edition.slug,
                  website_url: edition.website_url,
                  start_date: edition.start_date,
                  end_date: edition.end_date,
                  city_id: edition.city_id,
                  venue_id: edition.venue_id,
                  last_reviewed_at: edition.last_reviewed_at,
                  primary_source_url: edition.primary_source_url,
                  sponsor_note_type: edition.sponsor_note_type,
                })}
                linkedVenue={
                  edition.venues
                    ? {
                        id: edition.venues.id,
                        name: edition.venues.name,
                        archived: edition.venues.archived_at !== null,
                      }
                    : edition.venue_id
                      ? {
                          id: edition.venue_id,
                          name: "Linked venue",
                          archived: false,
                        }
                      : null
                }
              />
              <div className="border-t border-slate-200 pt-8">
                <h2 className="mb-3 text-lg font-semibold text-slate-900">Organizers</h2>
                <p className="mb-4 text-sm text-slate-500">
                  Edition metadata — link companies that organize or host this occurrence.
                </p>
                {organizersPanelError ? (
                  <InlineErrorBanner message={`Organizers unavailable: ${organizersPanelError}`} />
                ) : (
                  <EditionOrganizersPanel
                    editionId={edition.id}
                    editionName={edition.name}
                    editionYear={edition.year}
                    organizers={panels.organizers}
                  />
                )}
              </div>
            </div>
          }
          sponsorsPanel={
            sponsorsPanelError ? (
              <InlineErrorBanner message={`Live sponsors unavailable: ${sponsorsPanelError}`} />
            ) : (
              <EditionSponsorsPanel
                editionId={edition.id}
                editionName={edition.name}
                editionYear={edition.year}
                editionSlug={edition.slug}
                eventWebsiteUrl={edition.website_url}
                sponsors={panels.sponsors}
                activeImport={activeImport}
                sponsorNoteType={sponsorNoteType}
              />
            )
          }
          importsPanel={
            importsPanelError ? (
              <InlineErrorBanner message={`Import history unavailable: ${importsPanelError}`} />
            ) : (
              <EditionImportsPanel data={importsData} />
            )
          }
        />
    </section>
    </EditionLiveSponsorCountProvider>
  );
}
