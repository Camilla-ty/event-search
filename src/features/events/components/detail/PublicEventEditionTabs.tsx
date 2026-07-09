"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import {
  fileTabBarClass,
  fileTabLinkClass,
  fileTabPanelClass,
  fileTabScrollRowClass,
  fileTabShellClass,
} from "@/src/lib/design/classes";

import {
  buildPublicEditionTabHref,
  type PublicEditionTabId,
} from "./publicEditionTabUrls";

const BASE_TABS = [
  { id: "overview", label: "Overview" },
  { id: "sponsors", label: "Sponsors" },
  { id: "venue", label: "Venue" },
  { id: "organizers", label: "Organizers" },
] as const;

export type { PublicEditionTabId };

type PublicEventEditionTabsProps = {
  eventSlug: string;
  showPartnerAlumniTab: boolean;
  overviewPanel: ReactNode;
  sponsorsPanel: ReactNode;
  venuePanel: ReactNode;
  organizersPanel: ReactNode;
  partnerAlumniPanel: ReactNode;
};

export function parsePublicEditionTab(
  raw: string | null,
  showPartnerAlumniTab: boolean,
): PublicEditionTabId {
  if (raw === "partner-alumni") {
    return showPartnerAlumniTab ? "partner-alumni" : "overview";
  }
  if (raw === "sponsors" || raw === "venue" || raw === "organizers") return raw;
  return "overview";
}

export function PublicEventEditionTabs({
  eventSlug,
  showPartnerAlumniTab,
  overviewPanel,
  sponsorsPanel,
  venuePanel,
  organizersPanel,
  partnerAlumniPanel,
}: PublicEventEditionTabsProps) {
  const searchParams = useSearchParams();
  const activeTab = parsePublicEditionTab(searchParams.get("tab"), showPartnerAlumniTab);

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
    <div className={fileTabShellClass}>
      <nav aria-label="Event edition sections" className={fileTabBarClass} role="tablist">
        <div className={fileTabScrollRowClass}>
          {tabs.map((tab) => {
            const href = buildPublicEditionTabHref(eventSlug, tab.id);
            const active = activeTab === tab.id;
            return (
              <Link
                key={tab.id}
                href={href}
                role="tab"
                aria-current={active ? "page" : undefined}
                aria-selected={active}
                className={fileTabLinkClass(active)}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className={fileTabPanelClass}>{activePanel}</div>
    </div>
  );
}
