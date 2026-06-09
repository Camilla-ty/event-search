import Link from "next/link";

import { AdminBreadcrumbs } from "@/src/features/admin/components/AdminBreadcrumbs";
import { AdminPageHeader } from "@/src/features/admin/components/AdminPageHeader";
import { Button } from "@/src/components/common";

export const dynamic = "force-dynamic";

export default function SponsorImportsStubPage() {
  return (
    <section>
      <AdminBreadcrumbs
        items={[{ label: "Admin", href: "/admin" }, { label: "Sponsor imports" }]}
      />
      <AdminPageHeader
        title="Sponsor imports"
        description="Upload Excel sponsor lists for an event edition. Full import workflow ships in Phase 4."
      />

      <div className="rounded-xl border border-sky-200 bg-sky-50 px-5 py-4 text-sm text-sky-950">
        <p className="font-semibold">Coming in Phase 4</p>
        <p className="mt-2">
          Database migration and import API are not live yet. You can create event editions
          now and use <strong>Create &amp; import sponsors</strong> to save the edition —
          import will activate once Phase 4 is deployed.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button type="button" disabled title="Available after Phase 4">
          New import
        </Button>
      </div>

      <div className="mt-8 rounded-xl border border-slate-200 bg-white px-5 py-6">
        <h2 className="font-semibold text-slate-900">What you can do now</h2>
        <ul className="mt-3 space-y-2 text-sm">
          <li>
            <Link href="/admin/events/editions/new" className="text-brand-primary hover:underline">
              Create event edition
            </Link>
          </li>
          <li>
            <Link href="/admin/events/editions" className="text-brand-primary hover:underline">
              View event editions
            </Link>
          </li>
          <li>
            <Link href="/admin/companies" className="text-brand-primary hover:underline">
              Manage companies
            </Link>
          </li>
        </ul>
      </div>

      <p className="mt-8 text-center text-sm text-slate-500">
        No sponsor imports yet. Start by creating an event edition, then return here after
        Phase 4 to upload your first Excel file.
      </p>

      <p className="mt-4 text-xs text-slate-500">
        Expected flow: Excel file → validation → review → draft → publish.
      </p>
    </section>
  );
}
