import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminBreadcrumbs } from "@/src/features/admin/components/AdminBreadcrumbs";
import { AdminPageHeader } from "@/src/features/admin/components/AdminPageHeader";
import { CompanyAdminForm } from "@/src/features/companies/components/admin/CompanyAdminForm";
import { getCityOptions } from "@/src/features/companies/server/getCityOptions";
import { getCompanyAdminById } from "@/src/features/companies/server/companyAdmin";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminCompanyDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [company, cities] = await Promise.all([
    getCompanyAdminById(id),
    getCityOptions(),
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
        initial={{
          name: company.name,
          website: company.website ?? "",
          slug: company.slug,
          city_id: company.city_id ?? "",
          logo_url: company.logo_url ?? "",
          short_description: company.short_description ?? "",
          description: company.description ?? "",
        }}
      />
    </section>
  );
}
