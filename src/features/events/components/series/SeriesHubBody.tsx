import Link from "next/link";

import { SeriesEditionsList } from "@/src/features/events/components/series/SeriesEditionsList";
import { SeriesParticipatedEventsList } from "@/src/features/events/components/series/SeriesParticipatedEventsList";
import type { PublicEditionSummary } from "@/src/features/events/types/publicEdition";
import type { SeriesParticipatedEvent } from "@/src/features/events/types/seriesParticipatedEvents";
import {
  fileTabBarClass,
  fileTabLinkClass,
  fileTabPanelClass,
  fileTabScrollRowClass,
  fileTabShellClass,
} from "@/src/lib/design/classes";
import { buildSeriesHubPath } from "@/src/lib/routes/explorerUrls";

export type SeriesHubTabId = "events" | "participated";

export function parseSeriesHubTab(
  raw: string | null | undefined,
  hasParticipatedEvents: boolean,
): SeriesHubTabId {
  if (raw === "participated" && hasParticipatedEvents) return "participated";
  return "events";
}

export function buildSeriesHubTabHref(
  series: { slug?: string | null; id?: string | null },
  tab: SeriesHubTabId,
): string {
  const base = buildSeriesHubPath(series) ?? "/events";
  return tab === "participated" ? `${base}?tab=participated` : base;
}

type SeriesHubBodyProps = {
  series: { slug: string; id: string };
  editions: PublicEditionSummary[];
  participatedEvents: ReadonlyArray<SeriesParticipatedEvent>;
  activeTab: SeriesHubTabId;
};

/**
 * Series hub body: Events (own editions) always; Participated Events only when results exist.
 * When both tabs are shown, chrome uses the public fileTab* tokens (same visual system as
 * Event Edition tabs) while keeping Series-owned URL helpers and server Link navigation.
 */
export function SeriesHubBody({
  series,
  editions,
  participatedEvents,
  activeTab,
}: SeriesHubBodyProps) {
  const showParticipatedTab = participatedEvents.length > 0;

  const panel =
    activeTab === "participated" && showParticipatedTab ? (
      <SeriesParticipatedEventsList items={participatedEvents} />
    ) : (
      <SeriesEditionsList editions={editions} />
    );

  if (!showParticipatedTab) {
    return <div className="space-y-6">{panel}</div>;
  }

  const eventsActive = activeTab === "events";
  const participatedActive = activeTab === "participated";

  return (
    <div className={fileTabShellClass}>
      <nav
        aria-label="Event brand sections"
        className={fileTabBarClass}
        role="tablist"
      >
        <div className={fileTabScrollRowClass}>
          <Link
            href={buildSeriesHubTabHref(series, "events")}
            role="tab"
            aria-current={eventsActive ? "page" : undefined}
            aria-selected={eventsActive}
            className={fileTabLinkClass(eventsActive)}
          >
            Events
          </Link>
          <Link
            href={buildSeriesHubTabHref(series, "participated")}
            role="tab"
            aria-current={participatedActive ? "page" : undefined}
            aria-selected={participatedActive}
            className={fileTabLinkClass(participatedActive)}
          >
            Participated Events
          </Link>
        </div>
      </nav>

      <div className={fileTabPanelClass}>{panel}</div>
    </div>
  );
}
