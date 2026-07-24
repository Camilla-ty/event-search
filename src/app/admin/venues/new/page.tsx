import { AdminBreadcrumbs } from "@/src/features/admin/components/AdminBreadcrumbs";
import { AdminPageHeader } from "@/src/features/admin/components/AdminPageHeader";
import { VenueForm } from "@/src/features/venues/components/admin/VenueForm";
import { getCityOptions } from "@/src/features/companies/server/getCityOptions";

export const dynamic = "force-dynamic";

export default async function NewVenueAdminPage() {
  const cities = await getCityOptions();

  return (
    <section>
      <AdminBreadcrumbs
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Venues", href: "/admin/venues" },
          { label: "Create" },
        ]}
      />
      <AdminPageHeader
        title="Create venue"
        description="Add a reusable venue for events. City is required. Duplicate names in the same city produce a warning only."
      />
      <VenueForm
        mode="create"
        cities={cities}
        initial={{
          name: "",
          slug: "",
          city_id: "",
          website_url: "",
          address_text: "",
          logo_url: "",
        }}
      />
    </section>
  );
}
