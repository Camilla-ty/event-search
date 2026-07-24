import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminBreadcrumbs } from "@/src/features/admin/components/AdminBreadcrumbs";
import { AdminPageHeader } from "@/src/features/admin/components/AdminPageHeader";
import { NewImportForm } from "@/src/features/partner-alumni-import/components/NewImportForm";
import { loadPartnerAlumniImportNewPage } from "@/src/features/partner-alumni-import/server/partnerAlumniImportNewPageLoad";
import { secondaryCtaClass } from "@/src/lib/design/classes";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string; versionId: string }>;
};

export default async function PartnerAlumniImportNewPage({ params }: PageProps) {
  const { id: seriesId, versionId } = await params;

  const pageData = await loadPartnerAlumniImportNewPage({ seriesId, versionId });
  if (!pageData) notFound();

  const { versionContext, activeBatchId } = pageData;
  const scope = { seriesId, versionId };

  return (
    <section>
      <AdminBreadcrumbs
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Event brands", href: "/admin/events/series" },
          { label: versionContext.seriesName, href: `/admin/events/series/${seriesId}` },
          { label: "Import companies" },
        ]}
      />
      <AdminPageHeader
        title="Import Partner Alumni companies"
        description={`Upload a spreadsheet into ${versionContext.versionLabel}. Full-page batch workflow with review and explicit create-new acknowledgment.`}
      />

      {versionContext.warnings.length > 0 ? (
        <ul className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {versionContext.warnings.map((w) => (
            <li key={w}>· {w}</li>
          ))}
        </ul>
      ) : null}

      <NewImportForm
        scope={scope}
        versionLabel={versionContext.versionLabel}
        activeBatchId={activeBatchId}
      />

      <div className="mt-8">
        <Link href={`/admin/events/series/${seriesId}`} className={`${secondaryCtaClass} h-9 text-sm`}>
          Back to event brand
        </Link>
      </div>
    </section>
  );
}
