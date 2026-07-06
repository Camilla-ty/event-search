import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminBreadcrumbs } from "@/src/features/admin/components/AdminBreadcrumbs";
import { AdminPageHeader } from "@/src/features/admin/components/AdminPageHeader";
import { EventsSubNav } from "@/src/features/admin/components/EventsSubNav";
import { SeriesPartnerAlumniPanel } from "@/src/features/partner-alumni/components/admin/SeriesPartnerAlumniPanel";
import { loadPartnerAlumniAdminForSeriesPage } from "@/src/features/partner-alumni/server/partnerAlumniAdminPageLoad";
import { EventSeriesForm } from "@/src/features/events/components/admin/EventSeriesForm";
import { SeriesKeywordsChips } from "@/src/features/events/components/admin/SeriesKeywordsChips";
import { getEventSeriesAdminById } from "@/src/features/events/server/eventSeriesAdmin";
import { primaryCtaClass } from "@/src/lib/design/classes";
import { formatLocationFromCityEmbed } from "@/src/lib/location/parseLocationEmbed";
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
          { label: "Series", href: "/admin/events/series" },
          { label: series.name },
        ]}
      />
      <AdminPageHeader
        title={series.name}
        description="Edit series profile and manage editions."
        actions={
          <Link
            href={`/admin/events/editions/new?seriesId=${series.id}`}
            className={`${primaryCtaClass} h-10`}
          >
            Create edition
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
          description: series.description ?? "",
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

      <SeriesPartnerAlumniPanel
        seriesId={series.id}
        initialData={partnerAlumniLoad.data}
        initialLoadError={partnerAlumniLoad.loadError}
      />

      <div className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Editions</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Year</th>
                <th className="px-4 py-3">City</th>
                <th className="px-4 py-3">Live sponsors</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {editions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                    No editions for this series yet.
                  </td>
                </tr>
              ) : (
                editions.map((edition) => (
                  <tr key={edition.id} className="border-b border-slate-100">
                    <td className="px-4 py-3">{edition.name}</td>
                    <td className="px-4 py-3">{edition.year}</td>
                    <td className="px-4 py-3">
                      {formatLocationFromCityEmbed(edition.cities) || "—"}
                    </td>
                    <td className="px-4 py-3">{edition.live_sponsor_count}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/events/editions/${edition.id}`}
                        className="text-brand-primary hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
