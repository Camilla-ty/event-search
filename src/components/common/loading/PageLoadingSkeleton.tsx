import { SkeletonBlock } from "@/src/components/common/loading/primitives/SkeletonBlock";
import { SkeletonLine } from "@/src/components/common/loading/primitives/SkeletonLine";
import { skeletonBorderClass, skeletonPulseWrapperClass } from "@/src/components/common/loading/skeletonTokens";

type PageLoadingVariant = "list" | "detail" | "form" | "explorer";

type PageLoadingSkeletonProps = {
  variant?: PageLoadingVariant;
};

export function PageLoadingSkeleton({ variant = "list" }: PageLoadingSkeletonProps) {
  if (variant === "detail") {
    return <DetailVariant />;
  }

  if (variant === "form") {
    return <FormVariant />;
  }

  if (variant === "explorer") {
    return <ExplorerVariant />;
  }

  return <ListVariant />;
}

function ListVariant() {
  return (
    <div
      className={[skeletonPulseWrapperClass, "space-y-3"].join(" ")}
      aria-busy="true"
      aria-label="Loading list"
    >
      {Array.from({ length: 5 }).map((_, index) => (
        <SkeletonBlock
          key={index}
          rounded="xl"
          tone="surface"
          className={`h-28 border ${skeletonBorderClass}`}
        />
      ))}
    </div>
  );
}

function DetailVariant() {
  return (
    <div
      className={[skeletonPulseWrapperClass, "space-y-4"].join(" ")}
      aria-busy="true"
      aria-label="Loading content"
    >
      <SkeletonLine size="md" className="w-40" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
        <SkeletonBlock rounded="xl" className="aspect-[16/9]" />
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
          <SkeletonLine className="w-24" />
          <SkeletonLine size="lg" className="w-2/3" />
          <SkeletonLine className="w-1/2" />
        </div>
      </div>
      <SkeletonBlock rounded="xl" className="h-40" />
    </div>
  );
}

function FormVariant() {
  return (
    <div
      className={[
        skeletonPulseWrapperClass,
        "space-y-4 rounded-xl border border-slate-200 bg-white p-6",
      ].join(" ")}
      aria-busy="true"
      aria-label="Loading form"
    >
      <SkeletonLine className="h-6 w-48" />
      <SkeletonLine className="w-72" />
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="space-y-2">
          <SkeletonLine className="w-24" />
          <SkeletonBlock className="h-10" />
        </div>
      ))}
      <SkeletonBlock className="h-10" />
    </div>
  );
}

function ExplorerVariant() {
  return (
    <div
      className={[skeletonPulseWrapperClass, "space-y-4"].join(" ")}
      aria-busy="true"
      aria-label="Loading explorer"
    >
      <div className="space-y-2 border-b border-slate-200 pb-6">
        <SkeletonLine size="lg" className="w-56" />
        <SkeletonLine className="w-full max-w-xl" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="hidden h-72 rounded-xl border border-slate-200 bg-white md:block" />
        <div className="space-y-3">
          <div className="h-14 rounded-xl border border-slate-200 bg-white" />
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonBlock
              key={index}
              rounded="xl"
              tone="surface"
              className={`h-28 border ${skeletonBorderClass}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
