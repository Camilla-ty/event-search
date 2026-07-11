"use client";

import { useCallback, type ReactNode } from "react";

import { WarningBanner } from "@/src/features/admin/components/WarningBanner";
import {
  buildAdminEditionTabHref,
  parseAdminEditionTab,
  type AdminEditionTabId,
} from "@/src/features/events/components/admin/adminEditionTabUrls";
import { readTabSearchParamFromWindow } from "@/src/features/events/components/detail/instantTabNavigation";
import { useInstantTabNavigation } from "@/src/features/events/components/detail/useInstantTabNavigation";
import { navItemActiveClass, navItemInactiveClass } from "@/src/lib/design/classes";

const TABS = [
  { id: "profile", label: "Profile" },
  { id: "sponsors", label: "Live sponsors" },
  { id: "imports", label: "Imports" },
] as const;

type EditionDetailTabsProps = {
  editionId: string;
  initialTab: AdminEditionTabId;
  profileWarnings: string[];
  profilePanel: ReactNode;
  sponsorsPanel: ReactNode;
  importsPanel: ReactNode;
};

export function EditionDetailTabs({
  editionId,
  initialTab,
  profileWarnings,
  profilePanel,
  sponsorsPanel,
  importsPanel,
}: EditionDetailTabsProps) {
  const readTabFromLocation = useCallback(
    () => parseAdminEditionTab(readTabSearchParamFromWindow()),
    [],
  );

  const { activeTab, handleTabClick } = useInstantTabNavigation({
    initialTab,
    readTabFromLocation,
  });

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap gap-1 border-b border-slate-200 pb-3">
        {TABS.map((tab) => {
          const href = buildAdminEditionTabHref(editionId, tab.id);
          const active = activeTab === tab.id;
          return (
            <a
              key={tab.id}
              href={href}
              className={[
                "rounded-md px-3 py-1.5 text-sm",
                active ? navItemActiveClass : navItemInactiveClass,
              ].join(" ")}
              onClick={handleTabClick(tab.id, href)}
            >
              {tab.label}
            </a>
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
