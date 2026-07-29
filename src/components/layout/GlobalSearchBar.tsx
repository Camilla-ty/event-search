"use client";

import { useMemo, useState } from "react";
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
import { applyEventExplorerQueryChange } from "@/src/features/events/lib/eventExplorerQuery";
import { SponsorSearchCombobox } from "@/src/features/sponsors/components/search/SponsorSearchCombobox";
import { parseSponsorDiscoverySuggestQuery } from "@/src/features/sponsors/server/sponsorDiscoverySuggestParams";
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
  const pathScope = scopeForPathname(pathname);
  const [manualScope, setManualScope] = useState<GlobalSearchScope | null>(null);
  const [scopePathname, setScopePathname] = useState(pathname);

  if (pathname !== scopePathname) {
    setScopePathname(pathname);
    setManualScope(null);
  }

  const scope = manualScope ?? pathScope;
  const isEventExplorerPage = pathname === "/events";

  const sponsorQueryFromUrl = useMemo(() => {
    if (pathname !== "/sponsors") {
      return "";
    }
    return parseSponsorDiscoverySuggestQuery(searchParams.get("q"));
  }, [pathname, searchParams]);

  function handleEventSearch(query: string) {
    const trimmed = query.trim();

    if (isEventExplorerPage && eventExplorerBridge !== null) {
      // Empty submit is a no-op: applied Search is removed only via chip × or Clear all.
      if (trimmed === "") {
        return;
      }
      eventExplorerBridge.setFilters((current) =>
        applyEventExplorerQueryChange(current, trimmed),
      );
      return;
    }

    router.push(buildEventExplorerUrl(trimmed));
  }

  return (
    <div className={className}>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        Global search
      </p>
      <div className={explorerGlobalSearchToolbarClass}>
        <ExplorerScopeTabs scope={scope} onScopeChange={setManualScope} />
        {scope === "events" ? (
          <SearchBar
            variant="toolbar"
            ariaLabel="Search event name or domain"
            placeholder="Search event name or domain"
            onSearch={handleEventSearch}
            clearOnSubmit={isEventExplorerPage}
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
