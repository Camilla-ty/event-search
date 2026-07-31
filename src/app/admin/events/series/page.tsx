import Link from "next/link";

import { AdminBreadcrumbs } from "@/src/features/admin/components/AdminBreadcrumbs";
import { AdminPageHeader } from "@/src/features/admin/components/AdminPageHeader";
import { EventsSubNav } from "@/src/features/admin/components/EventsSubNav";
import { AdminEventSeriesListTable } from "@/src/features/events/components/admin/AdminEventSeriesListTable";
import { listEventSeriesAdmin } from "@/src/features/events/server/eventSeriesAdmin";
import { primaryCtaClass } from "@/src/lib/design/classes";

export const dynamic = "force-dynamic";

export default async function AdminEventSeriesListPage() {
  const series = await listEventSeriesAdmin();

  return (
    <section>
      <AdminBreadcrumbs
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Events", href: "/admin/events" },
          { label: "Event Series" },
        ]}
      />
      <AdminPageHeader
        title="Event Series"
        description="Recurring event identities."
        actions={
          <Link href="/admin/events/series/new" className={`${primaryCtaClass} h-10`}>
            Create event series
          </Link>
        }
      />
      <EventsSubNav />

      <AdminEventSeriesListTable series={series} />
    </section>
  );
}
