import Link from "next/link";

import { Badge } from "@/src/components/common";
import { ResearchPageStatusAction } from "@/src/features/research-pages/components/admin/ResearchPageStatusAction";
import {
  formatResearchPagePublicPath,
  formatResearchPageYearLabel,
} from "@/src/features/research-pages/lib/formatResearchPagePublicPath";
import type { ResearchPageListItem } from "@/src/features/research-pages/server/researchPageAdmin";

type ResearchPagesListTableProps = {
  pages: ResearchPageListItem[];
};

function ResearchPageStatusBadge({ status }: { status: string }) {
  if (status === "published") {
    return <Badge variant="success">Published</Badge>;
  }
  return <Badge variant="neutral">Draft</Badge>;
}

export function ResearchPagesListTable({ pages }: ResearchPagesListTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Topic</th>
            <th className="px-4 py-3 font-medium">Region</th>
            <th className="px-4 py-3 font-medium">Year</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Public URL</th>
            <th className="px-4 py-3 font-medium">Created</th>
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {pages.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                No research pages yet.{" "}
                <Link
                  href="/admin/research-pages/new"
                  className="text-brand-primary underline"
                >
                  Create one
                </Link>
              </td>
            </tr>
          ) : (
            pages.map((page) => {
              const publicPath = formatResearchPagePublicPath(
                page.topicSlug,
                page.regionSlug,
                page.year,
              );
              // Year-scoped public routes are Phase B; only all-years pages are
              // publicly linkable today.
              const canLinkPublic =
                page.status === "published" && page.year === null;
              return (
                <tr key={page.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {page.topicName}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{page.regionName}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatResearchPageYearLabel(page.year)}
                  </td>
                  <td className="px-4 py-3">
                    <ResearchPageStatusBadge status={page.status} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">
                    {canLinkPublic ? (
                      <Link
                        href={publicPath}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-primary hover:underline"
                      >
                        {publicPath} ↗
                      </Link>
                    ) : (
                      <span className="text-slate-400">{publicPath}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {new Date(page.createdAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/admin/research-pages/${page.id}/preview`}
                        className="text-sm text-brand-primary hover:underline"
                      >
                        Preview
                      </Link>
                      <ResearchPageStatusAction
                        pageId={page.id}
                        currentStatus={page.status}
                        year={page.year}
                      />
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
