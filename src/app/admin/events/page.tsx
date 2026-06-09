import Link from "next/link";

import { AdminBreadcrumbs } from "@/src/features/admin/components/AdminBreadcrumbs";
import { AdminPageHeader } from "@/src/features/admin/components/AdminPageHeader";
import { EventsSubNav } from "@/src/features/admin/components/EventsSubNav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/common";
import { primaryCtaClass } from "@/src/lib/design/classes";

export const dynamic = "force-dynamic";

export default function AdminEventsOverviewPage() {
  return (
    <section>
      <AdminBreadcrumbs
        items={[{ label: "Admin", href: "/admin" }, { label: "Events" }]}
      />
      <AdminPageHeader
        title="Events"
        description="Manage event series and editions before sponsor import."
        actions={
          <Link href="/admin/events/editions/new" className={`${primaryCtaClass} h-10`}>
            Create edition
          </Link>
        }
      />
      <EventsSubNav />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Event editions</CardTitle>
            <CardDescription>Year-specific events linked to sponsor imports.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/admin/events/editions"
              className="text-sm text-brand-primary hover:underline"
            >
              View all editions →
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Event series</CardTitle>
            <CardDescription>Recurring event brands.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/admin/events/series"
              className="text-sm text-brand-primary hover:underline"
            >
              View all series →
            </Link>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
