import { AdminBreadcrumbs } from "@/src/features/admin/components/AdminBreadcrumbs";
import { AdminPageHeader } from "@/src/features/admin/components/AdminPageHeader";
import { EventsSubNav } from "@/src/features/admin/components/EventsSubNav";
import { getCityOptions } from "@/src/features/companies/server/getCityOptions";
import { EventEditionForm } from "@/src/features/events/components/admin/EventEditionForm";
import { CURRENT_YEAR } from "@/src/features/events/components/admin/EventEditionForm";
import { getSeriesOptions } from "@/src/features/events/server/getSeriesOptions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ seriesId?: string }>;
};

export default async function AdminCreateEventEditionPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const [series, cities] = await Promise.all([getSeriesOptions(), getCityOptions()]);

  return (
    <section>
      <AdminBreadcrumbs
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Events", href: "/admin/events" },
          { label: "Editions", href: "/admin/events/editions" },
          { label: "Create" },
        ]}
      />
      <AdminPageHeader
        title="Create event edition"
        description="Create an occurrence of an event (e.g. TOKEN2049 Singapore 2026). Multiple editions per series and year are allowed — use city and a distinct slug to disambiguate."
      />
      <EventsSubNav />
      <EventEditionForm
        mode="create"
        series={series}
        cities={cities}
        initial={{
          series_id: params.seriesId ?? "",
          year: String(CURRENT_YEAR),
          name: "",
          slug: "",
          website_url: "",
          start_date: "",
          end_date: "",
          city_id: "",
        }}
      />
    </section>
  );
}
