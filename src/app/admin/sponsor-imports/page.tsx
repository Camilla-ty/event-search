import Link from "next/link";

import { AdminBreadcrumbs } from "@/src/features/admin/components/AdminBreadcrumbs";
import { AdminPageHeader } from "@/src/features/admin/components/AdminPageHeader";
import { ImportHistoryTable } from "@/src/features/sponsor-import/components/ImportHistoryTable";
import { getImportHistoryData } from "@/src/features/sponsor-import/server/importUiData";
import { primaryCtaClass } from "@/src/lib/design/classes";

export const dynamic = "force-dynamic";

export default async function SponsorImportsPage() {
  const { batches } = await getImportHistoryData(100);

  const tableRows = batches.map((b) => ({
    id: String(b.id),
    status: String(b.status),
    source_filename: String(b.source_filename),
    source_row_count: Number(b.source_row_count),
    created_at: String(b.created_at),
    edition_name: String(b.edition_name),
    edition_year: Number(b.edition_year),
    series_name: b.series_name != null ? String(b.series_name) : null,
    event_edition_id: String(b.event_edition_id),
  }));

  return (
    <section>
      <AdminBreadcrumbs
        items={[{ label: "Admin", href: "/admin" }, { label: "Sponsor imports" }]}
      />
      <AdminPageHeader
        title="Sponsor imports"
        description="Upload Excel sponsor lists for an event. One active import per event."
        actions={
          <Link href="/admin/sponsor-imports/new" className={`${primaryCtaClass} h-10`}>
            New import
          </Link>
        }
      />

      <ImportHistoryTable batches={tableRows} />
    </section>
  );
}
