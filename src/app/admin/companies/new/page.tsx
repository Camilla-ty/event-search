import { AdminBreadcrumbs } from "@/src/features/admin/components/AdminBreadcrumbs";
import { AdminPageHeader } from "@/src/features/admin/components/AdminPageHeader";
import { CompanyAdminForm } from "@/src/features/companies/components/admin/CompanyAdminForm";
import { getCityOptions } from "@/src/features/companies/server/getCityOptions";

export const dynamic = "force-dynamic";

export default async function NewCompanyAdminPage() {
  const cities = await getCityOptions();

  return (
    <section>
      <AdminBreadcrumbs
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Companies", href: "/admin/companies" },
          { label: "Create" },
        ]}
      />
      <AdminPageHeader
        title="Create company"
        description="Manually add a company to the global directory. Website is required."
      />
      <CompanyAdminForm
        mode="create"
        cities={cities}
        initial={{
          name: "",
          website: "",
          slug: "",
          city_id: "",
          logo_url: "",
          short_description: "",
          description: "",
        }}
      />
    </section>
  );
}
