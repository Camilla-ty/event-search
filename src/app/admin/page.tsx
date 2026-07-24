import Link from "next/link";

import { AdminBreadcrumbs } from "@/src/features/admin/components/AdminBreadcrumbs";
import { AdminPageHeader } from "@/src/features/admin/components/AdminPageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/common";
import { DashboardImportsWidget } from "@/src/features/sponsor-import/components/DashboardImportsWidget";
import { getDashboardImportsInProgress } from "@/src/features/sponsor-import/server/importUiData";
import { BRAND_NAME } from "@/src/lib/design/brand";
import { primaryCtaClass, secondaryCtaClass } from "@/src/lib/design/classes";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const inProgress = await getDashboardImportsInProgress();
  const widgetRows = inProgress.map((b) => ({
    id: String(b.id),
    status: String(b.status),
    source_filename: String(b.source_filename),
    source_row_count: Number(b.source_row_count),
    edition_name: String(b.edition_name),
    edition_year: Number(b.edition_year),
    series_name: b.series_name != null ? String(b.series_name) : null,
    event_edition_id: String(b.event_edition_id),
  }));
  return (
    <section className="space-y-6">
      <AdminBreadcrumbs items={[{ label: "Admin" }, { label: "Dashboard" }]} />
      <AdminPageHeader
        title="Dashboard"
        description={`Manage ${BRAND_NAME} events, companies, and sponsor data.`}
      />

      <DashboardImportsWidget batches={widgetRows} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
            <CardDescription>Start common admin workflows.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Link href="/admin/events/series/new" className={`${primaryCtaClass} h-10 text-center`}>
              Create event brand
            </Link>
            <Link href="/admin/events/editions/new" className={`${secondaryCtaClass} h-10 text-center`}>
              Create event
            </Link>
            <Link href="/admin/companies/new" className={`${secondaryCtaClass} h-10 text-center`}>
              Create company
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Events</CardTitle>
            <CardDescription>Event brands and events.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Link href="/admin/events" className="text-sm text-brand-primary hover:underline">
              Events overview →
            </Link>
            <Link
              href="/admin/events/series"
              className="text-sm text-brand-primary hover:underline"
            >
              All event brands →
            </Link>
            <Link
              href="/admin/events/editions"
              className="text-sm text-brand-primary hover:underline"
            >
              All events →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Companies</CardTitle>
            <CardDescription>Global sponsor directory.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/admin/companies" className="text-sm text-brand-primary hover:underline">
              Browse companies →
            </Link>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
