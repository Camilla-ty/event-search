import { AdminBreadcrumbs } from "@/src/features/admin/components/AdminBreadcrumbs";
import { AdminPageHeader } from "@/src/features/admin/components/AdminPageHeader";
import { CreateResearchPageForm } from "@/src/features/research-pages/components/admin/CreateResearchPageForm";
import {
  listRegionOptionsAdmin,
  listTopicOptionsAdmin,
} from "@/src/features/research-pages/server/researchPageAdmin";

export const dynamic = "force-dynamic";

export default async function AdminCreateResearchPagePage() {
  const [topics, regions] = await Promise.all([
    listTopicOptionsAdmin(),
    listRegionOptionsAdmin(),
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
        description="Select a Topic and Region combination. The page will be created as Draft and will not be publicly accessible until published."
      />
      <CreateResearchPageForm topics={topics} regions={regions} />
    </section>
  );
}
