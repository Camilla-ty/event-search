import Link from "next/link";

import { AdminBreadcrumbs } from "@/src/features/admin/components/AdminBreadcrumbs";
import { AdminPageHeader } from "@/src/features/admin/components/AdminPageHeader";
import { EventsSubNav } from "@/src/features/admin/components/EventsSubNav";
import { primaryCtaClass } from "@/src/lib/design/classes";
import { listEventSeriesAdmin } from "@/src/features/events/server/eventSeriesAdmin";

export const dynamic = "force-dynamic";

export default async function AdminEventSeriesListPage() {
  const series = await listEventSeriesAdmin();

  return (
    <section>
      <AdminBreadcrumbs
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Events", href: "/admin/events" },
          { label: "Event Brands" },
        ]}
      />
      <AdminPageHeader
        title="Event brands"
        description="Recurring event identities."
        actions={
          <Link href="/admin/events/series/new" className={`${primaryCtaClass} h-10`}>
            Create event brand
          </Link>
        }
      />
      <EventsSubNav />

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Slug</th>
              <th className="px-4 py-3 font-medium">Events</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {series.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  No event brands yet.{" "}
                  <Link href="/admin/events/series/new" className="text-brand-primary underline">
                    Create one
                  </Link>
                </td>
              </tr>
            ) : (
              series.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{row.slug}</td>
                  <td className="px-4 py-3 text-slate-600">{row.edition_count}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/events/series/${row.id}`}
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
    </section>
  );
}
