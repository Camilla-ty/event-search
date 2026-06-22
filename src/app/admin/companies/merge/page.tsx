import { AdminBreadcrumbs } from "@/src/features/admin/components/AdminBreadcrumbs";
import { AdminPageHeader } from "@/src/features/admin/components/AdminPageHeader";
import { MergeCompaniesPageClient } from "@/src/features/companies/components/admin/merge/MergeCompaniesPageClient";
import { buildMergeWizardPrefill } from "@/src/features/companies/components/admin/merge/mergeWizardPrefill";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    canonical?: string;
    duplicate?: string;
    mode?: string;
  }>;
};

export default async function AdminMergeCompaniesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const prefill = await buildMergeWizardPrefill({
    canonicalId: params.canonical,
    duplicateId: params.duplicate,
    mode: params.mode,
  });

  return (
    <section>
      <AdminBreadcrumbs
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Companies", href: "/admin/companies" },
          { label: "Merge companies" },
        ]}
      />
      <AdminPageHeader
        title="Merge companies"
        description="Combine duplicate company records. Preview impact before any merge is executed."
      />
      <MergeCompaniesPageClient prefill={prefill} />
    </section>
  );
}
