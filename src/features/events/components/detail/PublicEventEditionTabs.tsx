"use client";

import { useCallback, type ReactNode } from "react";

import {
  fileTabBarClass,
  fileTabLinkClass,
  fileTabPanelClass,
  fileTabScrollRowClass,
  fileTabShellClass,
} from "@/src/lib/design/classes";

import { readTabSearchParamFromWindow } from "@/src/features/events/components/detail/instantTabNavigation";
import { PublicEditionTabNavigationProvider } from "@/src/features/events/components/detail/PublicEditionTabNavigation";
import { useInstantTabNavigation } from "@/src/features/events/components/detail/useInstantTabNavigation";

import {
  buildPublicEditionTabHref,
  parsePublicEditionTab,
  type PublicEditionTabId,
} from "./publicEditionTabUrls";

type PublicEventEditionTabsProps = {
  eventSlug: string;
  initialTab: PublicEditionTabId;
  showExhibitorsTab: boolean;
  showPartnerAlumniTab: boolean;
  overviewPanel: ReactNode;
  sponsorsPanel: ReactNode;
  exhibitorsPanel: ReactNode;
  venuePanel: ReactNode;
  organizersPanel: ReactNode;
  partnerAlumniPanel: ReactNode;
};

export function PublicEventEditionTabs({
  eventSlug,
  initialTab,
  showExhibitorsTab,
  showPartnerAlumniTab,
  overviewPanel,
  sponsorsPanel,
  exhibitorsPanel,
  venuePanel,
  organizersPanel,
  partnerAlumniPanel,
}: PublicEventEditionTabsProps) {
  const readTabFromLocation = useCallback(
    () =>
      parsePublicEditionTab(readTabSearchParamFromWindow(), {
        showExhibitorsTab,
        showPartnerAlumniTab,
      }),
    [showExhibitorsTab, showPartnerAlumniTab],
  );

  const { activeTab, handleTabClick, selectTab } = useInstantTabNavigation({
    initialTab,
    readTabFromLocation,
  });

  const tabs: Array<{ id: PublicEditionTabId; label: string }> = [
    { id: "overview", label: "Overview" },
    { id: "sponsors", label: "Sponsors" },
  ];
  if (showExhibitorsTab) {
    tabs.push({ id: "exhibitors", label: "Exhibitors" });
  }
  tabs.push({ id: "venue", label: "Venue" }, { id: "organizers", label: "Organizers" });
  if (showPartnerAlumniTab) {
    tabs.push({ id: "partner-alumni", label: "Partner Alumni" });
  }

  const activePanel =
    activeTab === "overview"
      ? overviewPanel
      : activeTab === "sponsors"
        ? sponsorsPanel
        : activeTab === "exhibitors"
          ? exhibitorsPanel
          : activeTab === "venue"
            ? venuePanel
            : activeTab === "organizers"
              ? organizersPanel
              : partnerAlumniPanel;

  return (
    <PublicEditionTabNavigationProvider selectTab={selectTab}>
      <div className={fileTabShellClass}>
        <nav aria-label="Event sections" className={fileTabBarClass} role="tablist">
          <div className={fileTabScrollRowClass}>
            {tabs.map((tab) => {
              const href = buildPublicEditionTabHref(eventSlug, tab.id);
              const active = activeTab === tab.id;
              return (
                <a
                  key={tab.id}
                  href={href}
                  role="tab"
                  aria-current={active ? "page" : undefined}
                  aria-selected={active}
                  className={fileTabLinkClass(active)}
                  onClick={handleTabClick(tab.id, href)}
                >
                  {tab.label}
                </a>
              );
            })}
          </div>
        </nav>

        <div className={fileTabPanelClass}>{activePanel}</div>
      </div>
    </PublicEditionTabNavigationProvider>
  );
}
