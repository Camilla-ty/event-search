import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminBreadcrumbs } from "@/src/features/admin/components/AdminBreadcrumbs";
import { AdminPageHeader } from "@/src/features/admin/components/AdminPageHeader";
import { NewImportForm } from "@/src/features/sponsor-import/components/NewImportForm";
import { getEventEditionAdminById, listEventEditionsAdmin } from "@/src/features/events/server/eventEditionAdmin";
import { secondaryCtaClass } from "@/src/lib/design/classes";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ editionId?: string }>;
};

export default async function SponsorImportNewPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const editionId = params.editionId?.trim() ?? "";

  const [editions, preselected] = await Promise.all([
    listEventEditionsAdmin(),
    editionId !== "" ? getEventEditionAdminById(editionId) : Promise.resolve(null),
  ]);

  if (editionId !== "" && !preselected) {
    notFound();
  }

  const editionOptions = editions.map((e) => ({
    id: e.id,
    name: e.name,
    year: e.year,
    seriesName: e.event_series?.name ?? null,
  }));

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
        description="Upload an Excel file and map columns for a single event edition."
      />

      {preselected ? (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-950">
          <p className="font-semibold">Edition: {preselected.name}</p>
          <p className="mt-1">
            {preselected.event_series?.name ?? "—"} · {preselected.year}
          </p>
          <Link
            href={`/admin/events/editions/${preselected.id}`}
            className="mt-2 inline-block text-brand-primary hover:underline"
          >
            Edit edition profile
          </Link>
        </div>
      ) : null}

      <NewImportForm editions={editionOptions} preselectedEditionId={editionId || undefined} />

      <div className="mt-8">
        <Link href="/admin/sponsor-imports" className={`${secondaryCtaClass} h-9 text-sm`}>
          Back to sponsor imports
        </Link>
      </div>
    </section>
  );
}
