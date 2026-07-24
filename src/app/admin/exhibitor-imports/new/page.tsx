import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AdminBreadcrumbs } from "@/src/features/admin/components/AdminBreadcrumbs";
import { AdminPageHeader } from "@/src/features/admin/components/AdminPageHeader";
import { NewImportForm } from "@/src/features/exhibitor-import/components/NewImportForm";
import { getEventEditionAdminById } from "@/src/features/events/server/eventEditionAdmin";
import { secondaryCtaClass } from "@/src/lib/design/classes";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ editionId?: string }>;
};

export default async function ExhibitorImportNewPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const editionId = params.editionId?.trim() ?? "";

  if (editionId === "") {
    redirect("/admin/events");
  }

  const edition = await getEventEditionAdminById(editionId);
  if (!edition) {
    notFound();
  }

  const editionHref = `/admin/events/editions/${edition.id}?tab=exhibitors`;

  return (
    <section>
      <AdminBreadcrumbs
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Events", href: "/admin/events" },
          { label: edition.name, href: editionHref },
          { label: "Bulk Upload" },
        ]}
      />
      <AdminPageHeader
        title="Bulk Upload exhibitors"
        description="Upload a spreadsheet and map columns for this event’s exhibitors."
      />

      <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-950">
        <p className="font-semibold">Event: {edition.name}</p>
        <p className="mt-1">
          {edition.event_series?.name ?? "—"} · {edition.year}
        </p>
        <Link href={editionHref} className="mt-2 inline-block text-brand-primary hover:underline">
          Back to exhibitors
        </Link>
      </div>

      <NewImportForm editionId={edition.id} editionHref={editionHref} />

      <div className="mt-8">
        <Link href={editionHref} className={`${secondaryCtaClass} h-9 text-sm`}>
          Cancel
        </Link>
      </div>
    </section>
  );
}
