import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminBreadcrumbs } from "@/src/features/admin/components/AdminBreadcrumbs";
import { AdminPageHeader } from "@/src/features/admin/components/AdminPageHeader";
import { getEventEditionAdminById } from "@/src/features/events/server/eventEditionAdmin";
import { primaryCtaClass, secondaryCtaClass } from "@/src/lib/design/classes";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ editionId?: string }>;
};

export default async function SponsorImportNewStubPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const editionId = params.editionId?.trim() ?? "";

  const edition =
    editionId !== "" ? await getEventEditionAdminById(editionId) : null;

  if (editionId !== "" && !edition) {
    notFound();
  }

  return (
    <section>
      <AdminBreadcrumbs
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Sponsor imports", href: "/admin/sponsor-imports" },
          { label: "New import" },
        ]}
      />
      <AdminPageHeader
        title="Import sponsors"
        description="Sponsor import is not available until Phase 4."
      />

      {edition ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-950">
            <p className="font-semibold">Edition created successfully</p>
            <p className="mt-2">
              Sponsor import is not available until Phase 4. This edition is saved and
              ready — return here after import is deployed.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm">
            <dl className="grid gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Edition</dt>
                <dd className="font-medium text-slate-900">{edition.name}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Year</dt>
                <dd className="font-medium text-slate-900">{edition.year}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Series</dt>
                <dd className="font-medium text-slate-900">
                  {edition.event_series?.name ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Slug</dt>
                <dd className="font-mono text-xs text-slate-800">{edition.slug}</dd>
              </div>
            </dl>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/admin/events/editions/${edition.id}`}
              className={`${primaryCtaClass} h-10`}
            >
              Edit edition profile
            </Link>
            <Link
              href="/admin/events/editions"
              className={`${secondaryCtaClass} h-10`}
            >
              View all editions
            </Link>
            <Link
              href="/admin/sponsor-imports"
              className={`${secondaryCtaClass} h-10`}
            >
              Back to sponsor imports
            </Link>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-6 text-sm text-slate-600">
          <p>Select an edition from the sponsor import hub once Phase 4 is live.</p>
          <Link href="/admin/events/editions/new" className="mt-3 inline-block text-brand-primary underline">
            Create an event edition
          </Link>
        </div>
      )}
    </section>
  );
}
