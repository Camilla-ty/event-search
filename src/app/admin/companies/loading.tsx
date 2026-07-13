import { SkeletonLine } from "@/src/components/common/loading/primitives/SkeletonLine";
import { skeletonPulseWrapperClass } from "@/src/components/common/loading/skeletonTokens";
import { AdminCompaniesListSkeleton } from "@/src/features/companies/components/admin/AdminCompaniesListSkeleton";

export default function AdminCompaniesLoading() {
  return (
    <section className={["space-y-4", skeletonPulseWrapperClass].join(" ")} aria-busy="true">
      <div className="space-y-2">
        <SkeletonLine size="xs" className="w-32" />
        <SkeletonLine size="lg" className="w-40" />
        <SkeletonLine className="w-56" />
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonLine key={index} className="h-8 w-24 rounded-full" />
        ))}
      </div>
      <SkeletonLine className="h-10 w-full max-w-md" />
      <AdminCompaniesListSkeleton />
    </section>
  );
}
