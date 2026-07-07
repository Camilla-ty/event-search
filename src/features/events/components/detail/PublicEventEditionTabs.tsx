"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { navItemActiveClass, navItemInactiveClass } from "@/src/lib/design/classes";

const BASE_TABS = [
  { id: "overview", label: "Overview" },
  { id: "sponsors", label: "Sponsors" },
  { id: "venue", label: "Venue" },
  { id: "organizers", label: "Organizers" },
] as const;

type BaseTabId = (typeof BASE_TABS)[number]["id"];
export type PublicEditionTabId = BaseTabId | "partner-alumni";

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
  const basePath = `/events/${eventSlug}`;

  const tabs: Array<{ id: PublicEditionTabId; label: string }> = [...BASE_TABS];
  if (showPartnerAlumniTab) {
    tabs.push({ id: "partner-alumni", label: "Partner Alumni" });
  }

  return (
    <div className="space-y-6">
      <nav
        aria-label="Event edition sections"
        className="flex flex-wrap gap-1 border-b border-slate-200 pb-3"
      >
        {tabs.map((tab) => {
          const href = tab.id === "overview" ? basePath : `${basePath}?tab=${tab.id}`;
          const active = activeTab === tab.id;
          return (
            <Link
              key={tab.id}
              href={href}
              aria-current={active ? "page" : undefined}
              className={[
                "rounded-md px-3 py-1.5 text-base font-medium",
                active ? navItemActiveClass : navItemInactiveClass,
              ].join(" ")}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {activeTab === "overview" ? overviewPanel : null}
      {activeTab === "sponsors" ? sponsorsPanel : null}
      {activeTab === "venue" ? venuePanel : null}
      {activeTab === "organizers" ? organizersPanel : null}
      {activeTab === "partner-alumni" ? partnerAlumniPanel : null}
    </div>
  );
}
