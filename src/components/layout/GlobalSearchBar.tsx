"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { SearchBar } from "@/src/components/common";
import { SponsorSearchCombobox } from "@/src/features/sponsors/components/search/SponsorSearchCombobox";
import { parseSponsorDiscoverySuggestQuery } from "@/src/features/sponsors/server/sponsorDiscoverySuggestParams";
import { buildEventExplorerUrl } from "@/src/lib/routes/explorerUrls";

export type GlobalSearchScope = "sponsors" | "events";

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
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
        Global search
      </p>
      <div
        className="mb-3 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5"
        role="tablist"
        aria-label="Search scope"
      >
        <button
          type="button"
          role="tab"
          aria-selected={scope === "sponsors"}
          onClick={() => setScope("sponsors")}
          className={[
            "rounded-md px-3 py-1.5 text-xs font-medium transition",
            scope === "sponsors"
              ? "bg-brand-primary text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900",
          ].join(" ")}
        >
          Sponsors
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={scope === "events"}
          onClick={() => setScope("events")}
          className={[
            "rounded-md px-3 py-1.5 text-xs font-medium transition",
            scope === "events"
              ? "bg-brand-primary text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900",
          ].join(" ")}
        >
          Events
        </button>
      </div>
      {scope === "sponsors" ? (
        <SponsorSearchCombobox
          queryFromUrl={sponsorQueryFromUrl}
          ariaLabel="Search sponsoring companies globally"
          placeholder="Search sponsoring companies…"
          className="min-w-0 w-full"
          submitVariant="secondary"
        />
      ) : (
        <SearchBar
          ariaLabel="Search event name or domain"
          placeholder="Search event name or domain"
          onSearch={handleEventSearch}
          className="min-w-0 w-full"
          submitVariant="secondary"
        />
      )}
    </div>
  );
}
