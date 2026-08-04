import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminBreadcrumbs } from "@/src/features/admin/components/AdminBreadcrumbs";
import { AdminPageHeader } from "@/src/features/admin/components/AdminPageHeader";
import { EventsSubNav } from "@/src/features/admin/components/EventsSubNav";
import { SeriesPartnerAlumniPanel } from "@/src/features/partner-alumni/components/admin/SeriesPartnerAlumniPanel";
import { loadPartnerAlumniAdminForSeriesPage } from "@/src/features/partner-alumni/server/partnerAlumniAdminPageLoad";
import { AdminSeriesEditionsTable } from "@/src/features/events/components/admin/AdminSeriesEditionsTable";
import { EventSeriesForm } from "@/src/features/events/components/admin/EventSeriesForm";
import { SameBrandCompanyProfileSection } from "@/src/features/events/components/admin/SameBrandCompanyProfileSection";
import { SeriesKeywordsChips } from "@/src/features/events/components/admin/SeriesKeywordsChips";
import { getEventSeriesAdminById } from "@/src/features/events/server/eventSeriesAdmin";
import { primaryCtaClass } from "@/src/lib/design/classes";
import { listEventEditionsAdmin } from "@/src/features/events/server/eventEditionAdmin";
import {
  getKeywordsForSeriesId,
  listKeywordsAdmin,
} from "@/src/features/events/server/seriesKeywordsAdmin";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminEventSeriesDetailPage({ params }: PageProps) {
  const { id } = await params;
  const series = await getEventSeriesAdminById(id);
  if (!series) notFound();

  const [editions, allKeywords, seriesKeywords, partnerAlumniLoad] = await Promise.all([
    listEventEditionsAdmin({ seriesId: id }),
    listKeywordsAdmin(),
    getKeywordsForSeriesId(id),
    loadPartnerAlumniAdminForSeriesPage(id),
  ]);

  return (
    <section>
      <AdminBreadcrumbs
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Events", href: "/admin/events" },
          { label: "Event Series", href: "/admin/events/series" },
          { label: series.name },
        ]}
      />
      <AdminPageHeader
        title={series.name}
        description="Edit event series profile and manage event editions."
        actions={
          <Link
            href={`/admin/events/editions/new?seriesId=${series.id}`}
            className={`${primaryCtaClass} h-10`}
          >
            Create event edition
          </Link>
        }
      />
      <EventsSubNav />

      {seriesKeywords.length > 0 ? (
        <div className="mb-6">
          <SeriesKeywordsChips keywords={seriesKeywords} />
        </div>
      ) : null}

      <EventSeriesForm
        mode="edit"
        seriesId={series.id}
        allKeywords={allKeywords}
        initialKeywordIds={seriesKeywords.map((keyword) => keyword.id)}
        initial={{
          name: series.name,
          slug: series.slug,
          website_url: series.website_url ?? "",
          logo_url: series.logo_url ?? "",
          lifecycle_status: series.lifecycle_status ?? "",
          merged_into_series_id: series.merged_into_series_id ?? "",
        }}
        initialMergedIntoSeries={
          series.merged_into_series
            ? {
                id: series.merged_into_series.id,
                name: series.merged_into_series.name,
                slug: series.merged_into_series.slug,
              }
            : null
        }
      />

      <SameBrandCompanyProfileSection
        seriesId={series.id}
        seriesLifecycleStatus={series.lifecycle_status}
        initialCompanyProfileId={series.company_profile_id}
        initialCompanyProfile={series.company_profile ?? null}
      />

      <SeriesPartnerAlumniPanel
        seriesId={series.id}
        initialData={partnerAlumniLoad.data}
        initialLoadError={partnerAlumniLoad.loadError}
      />

      <div className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Event Editions</h2>
        <AdminSeriesEditionsTable editions={editions} />
      </div>
    </section>
  );
}
