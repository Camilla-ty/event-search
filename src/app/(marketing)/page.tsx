import type { Metadata } from "next";

import { DiscoverCalendarUpcomingSection } from "@/src/features/home/components/DiscoverCalendarUpcomingSection";
import { DiscoverEditionList } from "@/src/features/home/components/DiscoverEditionList";
import { DiscoverEventModule } from "@/src/features/home/components/DiscoverEventModule";
import { DiscoverHero } from "@/src/features/home/components/DiscoverHero";
import { getDiscoverHomeData } from "@/src/features/home/server/getDiscoverHomeData";
import { BRAND_NAME } from "@/src/lib/design/brand";
import { createPageMetadata } from "@/src/lib/metadata/site";
import { buildEventExplorerUpcomingUrl, buildEventExplorerRecentlyReviewedUrl } from "@/src/lib/routes/explorerUrls";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createPageMetadata({
  title: "Discover",
  description:
    `Discover events, sponsors, and companies with ${BRAND_NAME} event industry intelligence.`,
  path: "/",
});

export default async function DiscoverPage() {
  const { upcoming, recentlyReviewed, calendarEvents } = await getDiscoverHomeData();
  const upcomingViewAllHref = buildEventExplorerUpcomingUrl();
  const recentlyReviewedViewAllHref = buildEventExplorerRecentlyReviewedUrl();

  return (
    <div className="space-y-8">
      <DiscoverHero />

      <DiscoverCalendarUpcomingSection
        calendarEvents={calendarEvents}
        upcoming={upcoming}
        upcomingViewAllHref={upcomingViewAllHref}
      />

      <DiscoverEventModule
        title="Recently Reviewed Events"
        description="Event coverage most recently reviewed and verified on EventPixels."
        viewAllHref={recentlyReviewedViewAllHref}
        emptyMessage="No recently reviewed events yet."
        emptyActionHref={recentlyReviewedViewAllHref}
        isEmpty={recentlyReviewed.length === 0}
      >
        <DiscoverEditionList editions={recentlyReviewed} variant="full" />
      </DiscoverEventModule>
    </div>
  );
}
