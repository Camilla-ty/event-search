import { AdminVenuesPage } from "@/src/features/venues/components/admin/AdminVenuesPage";
import { buildAdminVenuesCollection } from "@/src/features/venues/server/adminVenuesCollection";
import { parseVenuesListParamsFromRecord } from "@/src/features/venues/server/venuesListParams";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ search?: string; includeArchived?: string }>;
};

export default async function AdminVenuesListPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const params = parseVenuesListParamsFromRecord(raw);
  const initial = await buildAdminVenuesCollection(params);

  return <AdminVenuesPage initial={initial} />;
}
