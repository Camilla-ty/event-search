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

const BASE_TABS = [
  { id: "overview", label: "Overview" },
  { id: "sponsors", label: "Sponsors" },
  { id: "venue", label: "Venue" },
  { id: "organizers", label: "Organizers" },
] as const;

type PublicEventEditionTabsProps = {
  eventSlug: string;
  initialTab: PublicEditionTabId;
  showPartnerAlumniTab: boolean;
  overviewPanel: ReactNode;
  sponsorsPanel: ReactNode;
  venuePanel: ReactNode;
  organizersPanel: ReactNode;
  partnerAlumniPanel: ReactNode;
};

export function PublicEventEditionTabs({
  eventSlug,
  initialTab,
  showPartnerAlumniTab,
  overviewPanel,
  sponsorsPanel,
  venuePanel,
  organizersPanel,
  partnerAlumniPanel,
}: PublicEventEditionTabsProps) {
  const readTabFromLocation = useCallback(
    () => parsePublicEditionTab(readTabSearchParamFromWindow(), showPartnerAlumniTab),
    [showPartnerAlumniTab],
  );

  const { activeTab, handleTabClick, selectTab } = useInstantTabNavigation({
    initialTab,
    readTabFromLocation,
  });

  const tabs: Array<{ id: PublicEditionTabId; label: string }> = [...BASE_TABS];
  if (showPartnerAlumniTab) {
    tabs.push({ id: "partner-alumni", label: "Partner Alumni" });
  }

  const activePanel =
    activeTab === "overview"
      ? overviewPanel
      : activeTab === "sponsors"
        ? sponsorsPanel
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
