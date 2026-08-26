import { AdminBreadcrumbs } from "@/src/features/admin/components/AdminBreadcrumbs";
import { AdminPageHeader } from "@/src/features/admin/components/AdminPageHeader";
import { CreateResearchPageForm } from "@/src/features/research-pages/components/admin/CreateResearchPageForm";
import {
  listCountryOptionsAdmin,
  listRegionOptionsAdmin,
  listTopicOptionsAdmin,
} from "@/src/features/research-pages/server/researchPageAdmin";

export const dynamic = "force-dynamic";

export default async function AdminCreateResearchPagePage() {
  const [topics, regions, countries] = await Promise.all([
    listTopicOptionsAdmin(),
    listRegionOptionsAdmin(),
    listCountryOptionsAdmin(),
  ]);

  return (
    <section>
      <AdminBreadcrumbs
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Research Pages", href: "/admin/research-pages" },
          { label: "Create" },
        ]}
      />
      <AdminPageHeader
        title="Create research page"
        description="Select a Topic and either a Region or a Country. The page will be created as Draft and will not be publicly accessible until published."
      />
      <CreateResearchPageForm
        topics={topics}
        regions={regions}
        countries={countries}
      />
    </section>
  );
}
