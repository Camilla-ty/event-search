import { AdminBreadcrumbs } from "@/src/features/admin/components/AdminBreadcrumbs";
import { AdminPageHeader } from "@/src/features/admin/components/AdminPageHeader";
import { EventsSubNav } from "@/src/features/admin/components/EventsSubNav";
import { EventSeriesForm } from "@/src/features/events/components/admin/EventSeriesForm";
import { listKeywordsAdmin } from "@/src/features/events/server/seriesKeywordsAdmin";

export const dynamic = "force-dynamic";

export default async function AdminCreateEventSeriesPage() {
  const allKeywords = await listKeywordsAdmin();
  return (
    <section>
      <AdminBreadcrumbs
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Events", href: "/admin/events" },
          { label: "Series", href: "/admin/events/series" },
          { label: "Create" },
        ]}
      />
      <AdminPageHeader
        title="Create event series"
        description="Register a recurring event brand before creating editions."
      />
      <EventsSubNav />
      <EventSeriesForm
        mode="create"
        allKeywords={allKeywords}
        initialKeywordIds={[]}
        initial={{
          name: "",
          slug: "",
          description: "",
          website_url: "",
          logo_url: "",
          lifecycle_status: "",
          merged_into_series_id: "",
        }}
      />
    </section>
  );
}
