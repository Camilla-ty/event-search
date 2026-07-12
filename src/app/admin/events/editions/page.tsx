import { AdminEventEditionsPage } from "@/src/features/events/components/admin/AdminEventEditionsPage";
import { buildAdminEditionsCollection } from "@/src/features/events/server/adminEditionsCollection";
import { parseEditionsListParamsFromRecord } from "@/src/features/events/server/editionsListParams";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    missingWebsite?: string;
    missingDates?: string;
    missingCity?: string;
  }>;
};

export default async function AdminEventEditionsListPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const params = parseEditionsListParamsFromRecord(raw);
  const initial = await buildAdminEditionsCollection(params);

  return <AdminEventEditionsPage initial={initial} />;
}
