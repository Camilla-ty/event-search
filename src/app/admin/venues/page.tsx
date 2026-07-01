import Link from "next/link";

import { AdminBreadcrumbs } from "@/src/features/admin/components/AdminBreadcrumbs";
import { AdminPageHeader } from "@/src/features/admin/components/AdminPageHeader";
import { AdminVenuesIncludeArchivedToggle } from "@/src/features/venues/components/admin/AdminVenuesIncludeArchivedToggle";
import { AdminVenuesListTable } from "@/src/features/venues/components/admin/AdminVenuesListTable";
import { AdminVenuesSearchForm } from "@/src/features/venues/components/admin/AdminVenuesSearchForm";
import { listVenuesAdmin } from "@/src/features/venues/server/venueAdmin";
import { primaryCtaClass } from "@/src/lib/design/classes";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ search?: string; includeArchived?: string }>;
};

export default async function AdminVenuesListPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const search = params.search?.trim() ?? "";
  const includeArchived = params.includeArchived === "true";

  const venues = await listVenuesAdmin({
    search: search || undefined,
    includeArchived,
  });

  return (
    <section>
      <AdminBreadcrumbs
        items={[{ label: "Admin", href: "/admin" }, { label: "Venues" }]}
      />
      <AdminPageHeader
        title="Venues"
        description={
          search !== ""
            ? `Search: “${search}” (${venues.length})`
            : includeArchived
              ? `All venues including archived (${venues.length})`
              : "Reusable event locations linked to editions."
        }
        actions={
          <Link href="/admin/venues/new" className={`${primaryCtaClass} h-10`}>
            Create venue
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <AdminVenuesIncludeArchivedToggle includeArchived={includeArchived} search={search} />
      </div>

      <AdminVenuesSearchForm initialSearch={search} includeArchived={includeArchived} />

      <AdminVenuesListTable venues={venues} />
    </section>
  );
}
