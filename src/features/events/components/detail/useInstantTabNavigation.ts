"use client";

import { useCallback, useEffect, useState, type MouseEvent } from "react";

import {
  pushHistoryUrl,
  shouldInterceptInPageAnchorClick,
} from "@/src/lib/navigation/historyUrl";

type UseInstantTabNavigationOptions<T extends string> = {
  initialTab: T;
  readTabFromLocation: () => T;
};

export function useInstantTabNavigation<T extends string>({
  initialTab,
  readTabFromLocation,
}: UseInstantTabNavigationOptions<T>) {
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    function handlePopState() {
      setActiveTab(readTabFromLocation());
    }

    globalThis.addEventListener("popstate", handlePopState);
    return () => globalThis.removeEventListener("popstate", handlePopState);
  }, [readTabFromLocation]);

  const selectTab = useCallback((tab: T, href: string) => {
    setActiveTab(tab);
    pushHistoryUrl(href);
  }, []);

  const handleTabClick = useCallback(
    (tab: T, href: string) => (event: MouseEvent<HTMLAnchorElement>) => {
      if (!shouldInterceptInPageAnchorClick(event)) return;
      event.preventDefault();
      selectTab(tab, href);
    },
    [selectTab],
  );

  return { activeTab, handleTabClick, selectTab };
}
