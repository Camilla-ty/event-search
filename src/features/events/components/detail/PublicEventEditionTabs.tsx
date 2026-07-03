"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { navItemActiveClass, navItemInactiveClass } from "@/src/lib/design/classes";

type PublicEventEditionTabsProps = {
  eventSlug: string;
  overviewPanel: ReactNode;
  sponsorsPanel: ReactNode;
  venuePanel: ReactNode;
  organizersPanel: ReactNode;
};

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "sponsors", label: "Sponsors" },
  { id: "venue", label: "Venue" },
  { id: "organizers", label: "Organizers" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function parseTab(raw: string | null): TabId {
  if (raw === "sponsors" || raw === "venue" || raw === "organizers") return raw;
  return "overview";
}

export function PublicEventEditionTabs({
  eventSlug,
  overviewPanel,
  sponsorsPanel,
  venuePanel,
  organizersPanel,
}: PublicEventEditionTabsProps) {
  const searchParams = useSearchParams();
  const activeTab = parseTab(searchParams.get("tab"));
  const basePath = `/events/${eventSlug}`;

  return (
    <div className="space-y-6">
      <nav
        aria-label="Event edition sections"
        className="flex flex-wrap gap-1 border-b border-slate-200 pb-3"
      >
        {TABS.map((tab) => {
          const href = tab.id === "overview" ? basePath : `${basePath}?tab=${tab.id}`;
          const active = activeTab === tab.id;
          return (
            <Link
              key={tab.id}
              href={href}
              aria-current={active ? "page" : undefined}
              className={[
                "rounded-md px-3 py-1.5 text-sm font-medium",
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
    </div>
  );
}
