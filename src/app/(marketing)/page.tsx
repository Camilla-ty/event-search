import type { Metadata } from "next";

import { DiscoverCalendarUpcomingSection } from "@/src/features/home/components/DiscoverCalendarUpcomingSection";
import { DiscoverEditionList } from "@/src/features/home/components/DiscoverEditionList";
import { DiscoverEventModule } from "@/src/features/home/components/DiscoverEventModule";
import { DiscoverHero } from "@/src/features/home/components/DiscoverHero";
import { getDiscoverHomeData } from "@/src/features/home/server/getDiscoverHomeData";
import { BRAND_NAME } from "@/src/lib/design/brand";
import { createPageMetadata } from "@/src/lib/metadata/site";
import { buildEventExplorerUpcomingUrl } from "@/src/lib/routes/explorerUrls";

export const dynamic = "force-dynamic";

export const metadata: Metadata = createPageMetadata({
  title: "Discover",
  description:
    `Discover events, sponsors, and companies with ${BRAND_NAME} event industry intelligence.`,
  path: "/",
});

export default async function DiscoverPage() {
  const { upcoming, recentlyAdded, calendarEvents } = await getDiscoverHomeData();
  const upcomingViewAllHref = buildEventExplorerUpcomingUrl();

  return (
    <div className="space-y-8">
      <DiscoverHero />

      <DiscoverCalendarUpcomingSection
        calendarEvents={calendarEvents}
        upcoming={upcoming}
        upcomingViewAllHref={upcomingViewAllHref}
      />

      <DiscoverEventModule
        title="Recently Added Events"
        description="The latest event coverage added to EventPixels."
        viewAllHref="/events"
        emptyMessage="No events published yet."
        emptyActionHref="/events"
        isEmpty={recentlyAdded.length === 0}
      >
        <DiscoverEditionList editions={recentlyAdded} />
      </DiscoverEventModule>
    </div>
  );
}
