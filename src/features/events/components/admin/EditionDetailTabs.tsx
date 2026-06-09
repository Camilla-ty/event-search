"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { WarningBanner } from "@/src/features/admin/components/WarningBanner";
import { navItemActiveClass, navItemInactiveClass } from "@/src/lib/design/classes";

type EditionDetailTabsProps = {
  editionId: string;
  profileWarnings: string[];
  profilePanel: ReactNode;
  sponsorsPanel: ReactNode;
  importsPanel: ReactNode;
};

const TABS = [
  { id: "profile", label: "Profile" },
  { id: "sponsors", label: "Live sponsors" },
  { id: "imports", label: "Imports" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function parseTab(raw: string | null): TabId {
  if (raw === "sponsors" || raw === "imports") return raw;
  return "profile";
}

export function EditionDetailTabs({
  editionId,
  profileWarnings,
  profilePanel,
  sponsorsPanel,
  importsPanel,
}: EditionDetailTabsProps) {
  const searchParams = useSearchParams();
  const activeTab = parseTab(searchParams.get("tab"));

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap gap-1 border-b border-slate-200 pb-3">
        {TABS.map((tab) => {
          const href = `/admin/events/editions/${editionId}?tab=${tab.id}`;
          const active = activeTab === tab.id;
          return (
            <Link
              key={tab.id}
              href={href}
              className={[
                "rounded-md px-3 py-1.5 text-sm",
                active ? navItemActiveClass : navItemInactiveClass,
              ].join(" ")}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {activeTab === "profile" ? (
        <>
          <WarningBanner messages={profileWarnings} />
          {profilePanel}
        </>
      ) : null}
      {activeTab === "sponsors" ? sponsorsPanel : null}
      {activeTab === "imports" ? importsPanel : null}
    </div>
  );
}
