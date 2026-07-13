import { SkeletonBlock } from "@/src/components/common/loading/primitives/SkeletonBlock";
import { SkeletonLine } from "@/src/components/common/loading/primitives/SkeletonLine";
import { skeletonPulseWrapperClass } from "@/src/components/common/loading/skeletonTokens";
import type { CompanyListFilter } from "@/src/features/companies/server/companyAdmin";

type AdminCompaniesListSkeletonProps = {
  filter?: CompanyListFilter;
  rowCount?: number;
};

function tableColumnCount(filter: CompanyListFilter): number {
  return filter === "needs_logo_review" ? 5 : 4;
}

type AdminCompaniesListSkeletonRowProps = {
  showWebsite: boolean;
};

function AdminCompaniesListSkeletonRow({ showWebsite }: AdminCompaniesListSkeletonRowProps) {
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-4 py-3 align-top">
        <SkeletonBlock rounded="lg" className="h-10 w-10" />
      </td>
      <td className="px-4 py-3">
        <SkeletonLine className="w-40" />
      </td>
      <td className="px-4 py-3">
        <SkeletonLine className="w-28" />
      </td>
      {showWebsite ? (
        <td className="px-4 py-3">
          <SkeletonLine className="w-36" />
        </td>
      ) : null}
      <td className="px-4 py-3">
        <SkeletonLine className="w-10" />
      </td>
    </tr>
  );
}

export function AdminCompaniesListSkeleton({
  filter = "all",
  rowCount = 6,
}: AdminCompaniesListSkeletonProps) {
  const showWebsite = filter === "needs_logo_review";

  return (
    <div
      className={[
        "overflow-x-auto rounded-xl border border-slate-200 bg-white",
        skeletonPulseWrapperClass,
      ].join(" ")}
      aria-busy="true"
      aria-label="Loading companies"
    >
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="w-20 px-4 py-3 font-medium">Logo</th>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Domain</th>
            {showWebsite ? (
              <th className="px-4 py-3 font-medium">Website</th>
            ) : null}
            <th className="px-4 py-3 font-medium">Event links</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rowCount }).map((_, index) => (
            <AdminCompaniesListSkeletonRow key={index} showWebsite={showWebsite} />
          ))}
        </tbody>
      </table>
      <span className="sr-only">{tableColumnCount(filter)} columns loading</span>
    </div>
  );
}
