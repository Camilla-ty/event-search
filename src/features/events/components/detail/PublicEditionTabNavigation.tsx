"use client";

import {
  createContext,
  useContext,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";

import { shouldInterceptInPageAnchorClick } from "@/src/lib/navigation/historyUrl";

import {
  buildPublicEditionTabHref,
  type PublicEditionTabId,
} from "./publicEditionTabUrls";

export type PublicEditionSelectTab = (tab: PublicEditionTabId, href: string) => void;

const PublicEditionTabNavigationContext = createContext<PublicEditionSelectTab | null>(
  null,
);

export function PublicEditionTabNavigationProvider({
  selectTab,
  children,
}: {
  selectTab: PublicEditionSelectTab;
  children: ReactNode;
}) {
  return (
    <PublicEditionTabNavigationContext.Provider value={selectTab}>
      {children}
    </PublicEditionTabNavigationContext.Provider>
  );
}

function usePublicEditionSelectTab(): PublicEditionSelectTab | null {
  return useContext(PublicEditionTabNavigationContext);
}

type PublicEditionInPageTabLinkProps = Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "href" | "onClick"
> & {
  eventSlug: string;
  tab: PublicEditionTabId;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
};

/**
 * In-page edition tab link that reuses PublicEventEditionTabs selectTab
 * (same path as the top tab bar). Falls back to normal navigation if
 * rendered outside the tab navigation provider.
 */
export function PublicEditionInPageTabLink({
  eventSlug,
  tab,
  children,
  onClick,
  ...rest
}: PublicEditionInPageTabLinkProps) {
  const selectTab = usePublicEditionSelectTab();
  const href = buildPublicEditionTabHref(eventSlug, tab);

  return (
    <a
      {...rest}
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        if (!selectTab) return;
        if (!shouldInterceptInPageAnchorClick(event)) return;
        event.preventDefault();
        selectTab(tab, href);
      }}
    >
      {children}
    </a>
  );
}
