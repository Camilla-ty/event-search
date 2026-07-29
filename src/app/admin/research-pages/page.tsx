import Link from "next/link";

import { AdminBreadcrumbs } from "@/src/features/admin/components/AdminBreadcrumbs";
import { AdminPageHeader } from "@/src/features/admin/components/AdminPageHeader";
import { ResearchPagesListTable } from "@/src/features/research-pages/components/admin/ResearchPagesListTable";
import { listResearchPagesAdmin } from "@/src/features/research-pages/server/researchPageAdmin";
import { primaryCtaClass } from "@/src/lib/design/classes";

export const dynamic = "force-dynamic";

export default async function AdminResearchPagesListPage() {
  const pages = await listResearchPagesAdmin();

  return (
    <section>
      <AdminBreadcrumbs
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Research Pages" },
        ]}
      />
      <AdminPageHeader
        title="Research Pages"
        description="Manage Topic × Region research pages. Only published pages are publicly accessible."
        actions={
          <Link
            href="/admin/research-pages/new"
            className={`${primaryCtaClass} h-10`}
          >
            Create research page
          </Link>
        }
      />
      <ResearchPagesListTable pages={pages} />
    </section>
  );
}
