import { AdminCompaniesPage } from "@/src/features/companies/components/admin/AdminCompaniesPage";
import { buildAdminCompaniesCollection } from "@/src/features/companies/server/adminCompaniesCollection";
import { parseCompaniesListParamsFromRecord } from "@/src/features/companies/server/companiesListParams";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ filter?: string; search?: string }>;
};

export default async function AdminCompaniesListPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const params = parseCompaniesListParamsFromRecord(raw);
  const initial = await buildAdminCompaniesCollection(params);

  return <AdminCompaniesPage initial={initial} />;
}
