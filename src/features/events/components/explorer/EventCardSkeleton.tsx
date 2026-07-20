import { SkeletonBlock } from "@/src/components/common/loading/primitives/SkeletonBlock";
import { SkeletonLine } from "@/src/components/common/loading/primitives/SkeletonLine";
import {
  skeletonBorderClass,
  skeletonPulseWrapperClass,
} from "@/src/components/common/loading/skeletonTokens";

const cardSurfaceClass = [
  "rounded-xl border bg-white p-4 shadow-sm",
  skeletonBorderClass,
].join(" ");

const DEFAULT_SKELETON_COUNT = 6;

function EventCardSkeletonMetaBlock({
  withDivider = false,
  region,
  children,
}: {
  withDivider?: boolean;
  region: "sponsors" | "date" | "location";
  children: React.ReactNode;
}) {
  return (
    <div
      className={`min-w-0 md:flex-1 ${
        withDivider ? "md:border-l md:border-slate-200 md:px-4" : "md:pr-4"
      }`}
      data-skeleton-region={region}
    >
      {children}
    </div>
  );
}

/** Single EventCard-shaped placeholder for Events Explorer loading. */
export function EventCardSkeleton() {
  return (
    <article className={cardSurfaceClass} data-skeleton="event-card">
      <div className="flex items-start gap-4">
        <div data-skeleton-region="logo" className="shrink-0">
          <SkeletonBlock
            rounded="lg"
            className={`h-14 w-14 border ${skeletonBorderClass}`}
          />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between md:gap-3">
            <div className="min-w-0 flex-1 space-y-2" data-skeleton-region="name">
              <SkeletonLine size="md" className="w-3/4 max-w-md" />
              <SkeletonLine className="w-1/2 max-w-xs md:hidden" />
            </div>
            <div
              className="flex flex-wrap gap-1.5 md:max-w-[45%] md:justify-end lg:max-w-[50%]"
              data-skeleton-region="topics"
            >
              <SkeletonLine className="h-5 w-16 rounded-full" />
              <SkeletonLine className="h-5 w-20 rounded-full" />
              <SkeletonLine className="hidden h-5 w-14 rounded-full sm:block" />
            </div>
          </div>

          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <EventCardSkeletonMetaBlock region="sponsors">
              <SkeletonLine className="w-24" />
            </EventCardSkeletonMetaBlock>
            <EventCardSkeletonMetaBlock region="date" withDivider>
              <SkeletonLine className="w-36" />
            </EventCardSkeletonMetaBlock>
            <EventCardSkeletonMetaBlock region="location" withDivider>
              <SkeletonLine className="w-28" />
            </EventCardSkeletonMetaBlock>
          </div>
        </div>
      </div>
    </article>
  );
}

type EventCardSkeletonListProps = {
  count?: number;
};

/** Card-shaped loading list used by Events Explorer while results refresh. */
export function EventCardSkeletonList({
  count = DEFAULT_SKELETON_COUNT,
}: EventCardSkeletonListProps) {
  const safeCount = Number.isFinite(count)
    ? Math.max(1, Math.trunc(count))
    : DEFAULT_SKELETON_COUNT;

  return (
    <div
      className={[skeletonPulseWrapperClass, "space-y-3"].join(" ")}
      aria-busy="true"
      aria-label="Loading events"
    >
      {Array.from({ length: safeCount }).map((_, index) => (
        <EventCardSkeleton key={index} />
      ))}
    </div>
  );
}
