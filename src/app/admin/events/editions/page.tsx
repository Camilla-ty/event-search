import Link from "next/link";

import { AdminBreadcrumbs } from "@/src/features/admin/components/AdminBreadcrumbs";
import { AdminPageHeader } from "@/src/features/admin/components/AdminPageHeader";
import { EventsSubNav } from "@/src/features/admin/components/EventsSubNav";
import { listEventEditionsAdmin } from "@/src/features/events/server/eventEditionAdmin";
import { primaryCtaClass } from "@/src/lib/design/classes";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    missingWebsite?: string;
    missingDates?: string;
    missingCity?: string;
  }>;
};

export default async function AdminEventEditionsListPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const editions = await listEventEditionsAdmin({
    missingWebsite: params.missingWebsite === "1",
    missingDates: params.missingDates === "1",
    missingCity: params.missingCity === "1",
  });

  return (
    <section>
      <AdminBreadcrumbs
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Events", href: "/admin/events" },
          { label: "Editions" },
        ]}
      />
      <AdminPageHeader
        title="Event editions"
        description="Each occurrence of an event (series + year + location). Multiple editions per series and year are allowed."
        actions={
          <Link href="/admin/events/editions/new" className={`${primaryCtaClass} h-10`}>
            Create edition
          </Link>
        }
      />
      <EventsSubNav />

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link
          href="/admin/events/editions"
          className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-50"
        >
          All
        </Link>
        <Link
          href="/admin/events/editions?missingWebsite=1"
          className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-50"
        >
          Missing website
        </Link>
        <Link
          href="/admin/events/editions?missingDates=1"
          className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-50"
        >
          Missing dates
        </Link>
        <Link
          href="/admin/events/editions?missingCity=1"
          className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-50"
        >
          Missing city
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Edition</th>
              <th className="px-4 py-3 font-medium">Series</th>
              <th className="px-4 py-3 font-medium">Year</th>
              <th className="px-4 py-3 font-medium">City</th>
              <th className="px-4 py-3 font-medium">Live sponsors</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {editions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No editions found.
                </td>
              </tr>
            ) : (
              editions.map((edition) => (
                <tr key={edition.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-900">{edition.name}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {edition.event_series?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{edition.year}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {edition.cities?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{edition.live_sponsor_count}</td>
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
    </section>
  );
}
