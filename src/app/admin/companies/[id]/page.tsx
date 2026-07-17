import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminBreadcrumbs } from "@/src/features/admin/components/AdminBreadcrumbs";
import { AdminPageHeader } from "@/src/features/admin/components/AdminPageHeader";
import { CompanyAdminForm } from "@/src/features/companies/components/admin/CompanyAdminForm";
import { CompanyAdminMergeActions } from "@/src/features/companies/components/admin/CompanyAdminMergeActions";
import { CompanyAdminStatusBadge } from "@/src/features/companies/components/admin/CompanyAdminStatusBadge";
import { CompanyPublicVisibilitySection } from "@/src/features/companies/components/admin/CompanyPublicVisibilitySection";
import { CompanyDomainsSection } from "@/src/features/companies/components/admin/CompanyDomainsSection";
import { CompanyMergeSuccessBanner } from "@/src/features/companies/components/admin/CompanyMergeSuccessBanner";
import { CompanyOrganizerRolesTable } from "@/src/features/companies/components/admin/CompanyOrganizerRolesTable";
import { CompanySponsorshipsTable } from "@/src/features/companies/components/admin/CompanySponsorshipsTable";
import { listCompanyDomainsForAdmin } from "@/src/features/companies/server/companyDomainsAdmin";
import { getCityOptions } from "@/src/features/companies/server/getCityOptions";
import {
  getCompanyAdminById,
  isCompanyAdminEditable,
} from "@/src/features/companies/server/companyAdmin";
import { listOrganizerRolesForCompanyAdmin } from "@/src/features/organizers/server/companyOrganizerAdmin";
import { listSponsorshipsForCompanyAdmin } from "@/src/features/companies/server/companySponsorshipAdmin";
import { feedbackWarningClass } from "@/src/lib/design/classes";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ logoWarning?: string; merged?: string; merge_id?: string }>;
};

export default async function AdminCompanyDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { logoWarning, merged, merge_id: mergeId } = await searchParams;
  const [company, cities, sponsorships, organizerRoles, domains] = await Promise.all([
    getCompanyAdminById(id),
    getCityOptions(),
    listSponsorshipsForCompanyAdmin(id),
    listOrganizerRolesForCompanyAdmin(id),
    listCompanyDomainsForAdmin(id),
  ]);

  if (!company) notFound();

  const isEditable = isCompanyAdminEditable(company);
  const canonicalCompany =
    company.merged_into_company_id !== null
      ? await getCompanyAdminById(company.merged_into_company_id)
      : null;
  const showMergeSuccess = merged === "1" && typeof mergeId === "string" && mergeId.trim() !== "";

  return (
    <section>
      <AdminBreadcrumbs
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Companies", href: "/admin/companies" },
          { label: company.name },
        ]}
      />

      {showMergeSuccess ? <CompanyMergeSuccessBanner mergeId={mergeId.trim()} /> : null}

      <AdminPageHeader
        title={company.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <CompanyAdminStatusBadge status={company.status} restrictedAt={company.restricted_at} />
            <span>
              {isEditable
                ? "Edit company profile."
                : "Merged company profile (read-only)."}
            </span>
          </span>
        }
        actions={
          <>
            {isEditable ? <CompanyAdminMergeActions companyId={company.id} /> : null}
            {company.slug && isEditable && company.restricted_at === null ? (
              <Link
                href={`/sponsors/${company.slug}`}
                className="inline-flex h-10 items-center text-sm text-brand-primary hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                View public page ↗
              </Link>
            ) : null}
          </>
        }
      />

      {!isEditable && canonicalCompany ? (
        <div className={`${feedbackWarningClass} mb-6 text-sm`}>
          This company was merged into{" "}
          <Link
            href={`/admin/companies/${canonicalCompany.id}`}
            className="font-medium text-brand-primary hover:underline"
          >
            {canonicalCompany.name}
          </Link>
          . The duplicate record is kept for audit and sponsorship history.
        </div>
      ) : null}

      <CompanyAdminForm
        key={`${company.id}:${company.domain ?? ""}:${company.website ?? ""}`}
        mode="edit"
        companyId={company.id}
        cities={cities}
        readOnly={!isEditable}
        readOnlyDomain={company.domain}
        initialNotice={logoWarning ?? null}
        initial={{
          name: company.name,
          website: company.website ?? "",
          slug: company.slug,
          city_id: company.city_id ?? "",
          logo_url: company.logo_url ?? "",
          aliases: [...company.aliases],
        }}
        initialLogoMetadata={{
          logo_url: company.logo_url ?? "",
          logo_source: company.logo_source,
          logo_status: company.logo_status,
          logo_fetched_at: company.logo_fetched_at,
        }}
      />

      <CompanyDomainsSection companyId={company.id} domains={domains} canAdd={isEditable} />

      <div className="mt-10">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">
          Sponsorships ({sponsorships.length})
        </h2>
        <p className="mb-3 text-sm text-slate-500">
          Read-only. Tier and roster changes are made on each edition&apos;s sponsors
          tab.
        </p>
        <CompanySponsorshipsTable sponsorships={sponsorships} />
      </div>

      <div className="mt-10">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">
          Organizer roles ({organizerRoles.length})
        </h2>
        <p className="mb-3 text-sm text-slate-500">
          Read-only. Organizer links are added and edited on each edition&apos;s Organizers
          tab.
        </p>
        <CompanyOrganizerRolesTable organizerRoles={organizerRoles} />
      </div>

      <CompanyPublicVisibilitySection
        companyId={company.id}
        companyName={company.name}
        restrictedAt={company.restricted_at}
        canRestrict={isEditable}
      />
    </section>
  );
}
