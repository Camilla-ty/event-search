"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { SearchBar } from "@/src/components/common";
import {
  ExplorerScopeTabs,
  explorerGlobalSearchToolbarClass,
  type ExplorerSearchScope,
} from "@/src/components/common/explorer";
import {
  useEventExplorerFilterBridgeConsumer,
} from "@/src/features/events/client/EventExplorerFilterBridge";
import {
  applyEventExplorerQueryChange,
  parseEventExplorerFiltersFromSearchParams,
} from "@/src/features/events/lib/eventExplorerQuery";
import { SponsorSearchCombobox } from "@/src/features/sponsors/components/search/SponsorSearchCombobox";
import { parseSponsorDiscoverySuggestQuery } from "@/src/features/sponsors/server/sponsorDiscoverySuggestParams";
import { readSearchParamsFromWindow } from "@/src/lib/navigation/historyUrl";
import { buildEventExplorerUrl } from "@/src/lib/routes/explorerUrls";

export type GlobalSearchScope = ExplorerSearchScope;

function scopeForPathname(pathname: string): GlobalSearchScope {
  if (pathname === "/events" || pathname.startsWith("/events/")) {
    return "events";
  }
  return "sponsors";
}

export function GlobalSearchBar({ className }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const eventExplorerBridge = useEventExplorerFilterBridgeConsumer();
  const [scope, setScope] = useState<GlobalSearchScope>(() => scopeForPathname(pathname));
  const [popstateQuery, setPopstateQuery] = useState<string | null>(null);

  const isEventExplorerPage = pathname === "/events";

  const sponsorQueryFromUrl = useMemo(() => {
    if (pathname !== "/sponsors") {
      return "";
    }
    return parseSponsorDiscoverySuggestQuery(searchParams.get("q"));
  }, [pathname, searchParams]);

  const eventExplorerQuery =
    eventExplorerBridge !== null ? eventExplorerBridge.filters.query : undefined;

  const eventQuerySync = useMemo(() => {
    if (!isEventExplorerPage) {
      return "";
    }
    if (popstateQuery !== null) {
      return popstateQuery;
    }
    if (eventExplorerQuery !== undefined) {
      return eventExplorerQuery;
    }
    return parseEventExplorerFiltersFromSearchParams(searchParams).query;
  }, [eventExplorerQuery, isEventExplorerPage, popstateQuery, searchParams]);

  useEffect(() => {
    setScope(scopeForPathname(pathname));
    setPopstateQuery(null);
  }, [pathname]);

  useEffect(() => {
    if (!isEventExplorerPage) {
      return;
    }

    function handlePopState() {
      const restored = parseEventExplorerFiltersFromSearchParams(readSearchParamsFromWindow());
      setPopstateQuery(restored.query);
    }

    globalThis.addEventListener("popstate", handlePopState);
    return () => globalThis.removeEventListener("popstate", handlePopState);
  }, [isEventExplorerPage]);

  useEffect(() => {
    if (eventExplorerQuery === undefined) {
      return;
    }
    setPopstateQuery(null);
  }, [eventExplorerQuery]);

  function handleEventSearch(query: string) {
    if (isEventExplorerPage && eventExplorerBridge !== null) {
      eventExplorerBridge.setFilters((current) => applyEventExplorerQueryChange(current, query));
      return;
    }

    router.push(buildEventExplorerUrl(query));
  }

  return (
    <div className={className}>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        Global search
      </p>
      <div className={explorerGlobalSearchToolbarClass}>
        <ExplorerScopeTabs scope={scope} onScopeChange={setScope} />
        {scope === "events" ? (
          <SearchBar
            variant="toolbar"
            ariaLabel="Search event name or domain"
            placeholder="Search event name or domain"
            onSearch={handleEventSearch}
            syncValue={isEventExplorerPage ? eventQuerySync : undefined}
            className="min-w-0 flex-1"
          />
        ) : (
          <SponsorSearchCombobox
            variant="toolbar"
            queryFromUrl={sponsorQueryFromUrl}
            ariaLabel="Search sponsoring companies globally"
            placeholder="Search sponsoring companies…"
            className="min-w-0 flex-1"
          />
        )}
      </div>
    </div>
  );
}
