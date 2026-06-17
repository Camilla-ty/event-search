import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminBreadcrumbs } from "@/src/features/admin/components/AdminBreadcrumbs";
import { AdminPageHeader } from "@/src/features/admin/components/AdminPageHeader";
import { CompanyAdminForm } from "@/src/features/companies/components/admin/CompanyAdminForm";
import { CompanySponsorshipsTable } from "@/src/features/companies/components/admin/CompanySponsorshipsTable";
import { getCityOptions } from "@/src/features/companies/server/getCityOptions";
import { getCompanyAdminById } from "@/src/features/companies/server/companyAdmin";
import { listSponsorshipsForCompanyAdmin } from "@/src/features/companies/server/companySponsorshipAdmin";
import { formatAliasesForInput } from "@/src/lib/companies/companyAliases";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ logoWarning?: string }>;
};

export default async function AdminCompanyDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { logoWarning } = await searchParams;
  const [company, cities, sponsorships] = await Promise.all([
    getCompanyAdminById(id),
    getCityOptions(),
    listSponsorshipsForCompanyAdmin(id),
  ]);

  if (!company) notFound();

  return (
    <section>
      <AdminBreadcrumbs
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Companies", href: "/admin/companies" },
          { label: company.name },
        ]}
      />
      <AdminPageHeader
        title={company.name}
        description="Edit company profile."
        actions={
          company.slug ? (
            <Link
              href={`/sponsors/${company.slug}`}
              className="text-sm text-brand-primary hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              View public page ↗
            </Link>
          ) : null
        }
      />

      <CompanyAdminForm
        mode="edit"
        companyId={company.id}
        cities={cities}
        readOnlyDomain={company.domain}
        initialNotice={logoWarning ?? null}
        initial={{
          name: company.name,
          website: company.website ?? "",
          slug: company.slug,
          city_id: company.city_id ?? "",
          logo_url: company.logo_url ?? "",
          aliases: formatAliasesForInput(company.aliases),
          short_description: company.short_description ?? "",
          description: company.description ?? "",
        }}
        initialLogoMetadata={{
          logo_url: company.logo_url ?? "",
          logo_source: company.logo_source,
          logo_status: company.logo_status,
          logo_fetched_at: company.logo_fetched_at,
        }}
      />

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
    </section>
  );
}
