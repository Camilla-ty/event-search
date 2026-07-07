"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { SearchBar } from "@/src/components/common";
import {
  ExplorerScopeTabs,
  explorerGlobalSearchToolbarClass,
  type ExplorerSearchScope,
} from "@/src/components/common/explorer";
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
  const [scope, setScope] = useState<GlobalSearchScope>(() => scopeForPathname(pathname));

  const sponsorQueryFromUrl = useMemo(() => {
    if (pathname !== "/sponsors") {
      return "";
    }
    return parseSponsorDiscoverySuggestQuery(searchParams.get("q"));
  }, [pathname, searchParams]);

  useEffect(() => {
    setScope(scopeForPathname(pathname));
  }, [pathname]);

  function handleEventSearch(query: string) {
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
