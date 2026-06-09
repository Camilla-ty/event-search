import Link from "next/link";

import { AdminBreadcrumbs } from "@/src/features/admin/components/AdminBreadcrumbs";
import { AdminPageHeader } from "@/src/features/admin/components/AdminPageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/common";
import { BRAND_NAME } from "@/src/lib/design/brand";
import { primaryCtaClass, secondaryCtaClass } from "@/src/lib/design/classes";

export const dynamic = "force-dynamic";

export default function AdminHomePage() {
  return (
    <section className="space-y-6">
      <AdminBreadcrumbs items={[{ label: "Admin" }, { label: "Dashboard" }]} />
      <AdminPageHeader
        title="Dashboard"
        description={`Manage ${BRAND_NAME} events, companies, and sponsor data.`}
      />

      <div className="rounded-xl border border-sky-200 bg-sky-50 px-5 py-4 text-sm text-sky-950">
        <p className="font-medium">Sponsor import — Phase 4</p>
        <p className="mt-1">
          Excel sponsor import is not available yet. Create event editions now; import will
          activate in a later release.
        </p>
        <Link href="/admin/sponsor-imports" className="mt-2 inline-block text-brand-primary underline">
          Sponsor imports hub
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
            <CardDescription>Start common admin workflows.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Link href="/admin/events/editions/new" className={`${primaryCtaClass} h-10 text-center`}>
              Create event edition
            </Link>
            <Link href="/admin/companies/new" className={`${secondaryCtaClass} h-10 text-center`}>
              Create company
            </Link>
            <Link href="/admin/events/series/new" className={`${secondaryCtaClass} h-10 text-center`}>
              Create event series
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Events</CardTitle>
            <CardDescription>Series and editions.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Link href="/admin/events" className="text-sm text-brand-primary hover:underline">
              Events overview →
            </Link>
            <Link
              href="/admin/events/editions"
              className="text-sm text-brand-primary hover:underline"
            >
              All editions →
            </Link>
            <Link
              href="/admin/events/series"
              className="text-sm text-brand-primary hover:underline"
            >
              All series →
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
