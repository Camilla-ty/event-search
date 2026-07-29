import { notFound } from "next/navigation";

import { AdminBreadcrumbs } from "@/src/features/admin/components/AdminBreadcrumbs";
import { TopicRegionHubView } from "@/src/features/events/components/topic-region/TopicRegionHubView";
import { getResearchPageById } from "@/src/features/research-pages/server/researchPageAdmin";
import { getTopicRegionHubPageData } from "@/src/features/events/server/topicRegionHubData";

export const dynamic = "force-dynamic";

type Params = { id: string };

export default async function AdminResearchPagePreview({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;

  const record = await getResearchPageById(id);
  if (!record) notFound();

  const data = await getTopicRegionHubPageData(record.topicSlug, record.regionSlug);

  return (
    <section>
      <AdminBreadcrumbs
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Research Pages", href: "/admin/research-pages" },
          { label: `${record.topicName} × ${record.regionName}` },
          { label: "Preview" },
        ]}
      />

      <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center rounded-full bg-amber-200 px-2.5 py-0.5 text-xs font-medium text-amber-800">
            Preview
          </span>
          <span className="inline-flex items-center rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-700">
            Status: {record.status}
          </span>
          {data ? (
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                data.passesGate
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              Gate: {data.passesGate ? "passes" : "fails"}
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-sm text-amber-800">
          This is an admin-only preview. {!data ? "No data is available for this combination yet." : !data.passesGate ? "This page does not yet meet the indexability threshold." : "This page meets the indexability threshold."}
        </p>
      </div>

      {data ? (
        <TopicRegionHubView data={data} />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-sm text-slate-500">
            No computed data available for {record.topicName} × {record.regionName}.
          </p>
          <p className="mt-1 text-xs text-slate-400">
            This combination has no matching events in the database.
          </p>
        </div>
      )}
    </section>
  );
}
