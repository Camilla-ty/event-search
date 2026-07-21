import type { EventRecord } from "@/src/features/events/components/explorer/types";
import { DiscoverCalendarPreview } from "@/src/features/home/components/DiscoverCalendarPreview";
import { DiscoverEditionList } from "@/src/features/home/components/DiscoverEditionList";
import { DiscoverEventModule } from "@/src/features/home/components/DiscoverEventModule";
import type { DiscoverEditionSummary } from "@/src/features/home/server/getDiscoverHomeData";

type DiscoverCalendarUpcomingSectionProps = {
  calendarEvents: readonly EventRecord[];
  upcoming: DiscoverEditionSummary[];
  upcomingViewAllHref: string;
};

export function DiscoverCalendarUpcomingSection({
  calendarEvents,
  upcoming,
  upcomingViewAllHref,
}: DiscoverCalendarUpcomingSectionProps) {
  return (
    <section className="grid grid-cols-1 gap-8 lg:grid-cols-12">
      <div className="space-y-3 lg:col-span-5">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-slate-900">Event Calendar</h2>
          <p className="text-sm text-slate-600">Browse events by month.</p>
        </div>
        <DiscoverCalendarPreview events={calendarEvents} />
      </div>

      <div className="lg:col-span-7">
        <DiscoverEventModule
          title="Upcoming Events"
          description="Events with upcoming or in-progress dates."
          viewAllHref={upcomingViewAllHref}
          emptyMessage="No upcoming events with scheduled dates."
          emptyActionHref={upcomingViewAllHref}
          isEmpty={upcoming.length === 0}
        >
          <DiscoverEditionList editions={upcoming} variant="compact" />
        </DiscoverEventModule>
      </div>
    </section>
  );
}
