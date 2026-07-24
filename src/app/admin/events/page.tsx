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
        description="Manage event brands and events before sponsor import."
        actions={
          <Link href="/admin/events/editions/new" className={`${primaryCtaClass} h-10`}>
            Create event
          </Link>
        }
      />
      <EventsSubNav />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Event brands</CardTitle>
            <CardDescription>Recurring event identities.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/admin/events/series"
              className="text-sm text-brand-primary hover:underline"
            >
              View all event brands →
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Events</CardTitle>
            <CardDescription>Occurrences linked to sponsor imports.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/admin/events/editions"
              className="text-sm text-brand-primary hover:underline"
            >
              View all events →
            </Link>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
