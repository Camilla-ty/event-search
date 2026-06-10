"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  ExplorerResultsToolbar,
  MobileFilterDrawer,
  PageHeader,
} from "@/src/components/common/explorer";
import {
  explorerFilterStickyClass,
  explorerPageGridClass,
} from "@/src/lib/layout/explorerLayout";

import { FilterPanel } from "./FilterPanel";
import { SponsorEventContextBanner } from "./SponsorEventContextBanner";
import { SponsorList } from "./SponsorList";
import type { FilterState, SponsorEventContext, SponsorRecord } from "./types";

type SortValue = "tier" | "name";

const SPONSOR_SORT_OPTIONS = [
  { value: "tier" as const, label: "Tier rank" },
  { value: "name" as const, label: "Name" },
];

type SponsorSearchPageProps = {
  sponsors: SponsorRecord[];
  initialFilters?: FilterState;
  eventContext?: SponsorEventContext | null;
};

const defaultFilters: FilterState = {
  query: "",
  industry: "all",
  eventSlug: null,
};

function normalizeText(value: string | null | undefined) {
  return (value ?? "").toLowerCase();
}

export function SponsorSearchPage({
  sponsors,
  initialFilters,
  eventContext = null,
}: SponsorSearchPageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<FilterState>(initialFilters ?? defaultFilters);
  const [sort, setSort] = useState<SortValue>("tier");
  const [page, setPage] = useState(1);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const industries = useMemo(() => {
    const values = sponsors
      .map((sponsor) => sponsor.companies?.industry)
      .filter((industry): industry is string => Boolean(industry?.trim()));
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
  }, [sponsors]);

  const filteredAndSorted = useMemo(() => {
    const byFilter = sponsors.filter((sponsor) => {
      const name = normalizeText(sponsor.companies?.name);
      const industry = sponsor.companies?.industry ?? "";
      const query = normalizeText(filters.query);
      const queryMatch = !query || name.includes(query);
      const industryMatch = filters.industry === "all" || industry === filters.industry;
      return queryMatch && industryMatch;
    });

    return byFilter.sort((a, b) => {
      if (sort === "name") {
        return (a.companies?.name ?? "").localeCompare(b.companies?.name ?? "");
      }
      const ar = a.tier_rank ?? Number.POSITIVE_INFINITY;
      const br = b.tier_rank ?? Number.POSITIVE_INFINITY;
      if (ar !== br) return ar - br;
      const ao = a.display_order ?? Number.POSITIVE_INFINITY;
      const bo = b.display_order ?? Number.POSITIVE_INFINITY;
      if (ao !== bo) return ao - bo;
      return (a.companies?.name ?? "").localeCompare(b.companies?.name ?? "");
    });
  }, [filters.industry, filters.query, sort, sponsors]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams.toString());
    if (filters.query.trim()) {
      next.set("q", filters.query.trim());
    } else {
      next.delete("q");
    }

    if (filters.industry !== "all") {
      next.set("industry", filters.industry);
    } else {
      next.delete("industry");
    }

    const eventSlug = filters.eventSlug?.trim() ?? "";
    if (eventSlug !== "") {
      next.set("event", eventSlug);
    } else {
      next.delete("event");
    }

    const current = searchParams.toString();
    const nextValue = next.toString();
    if (current !== nextValue) {
      router.replace(nextValue ? `${pathname}?${nextValue}` : pathname);
    }
  }, [filters, pathname, router, searchParams]);

  function handleReset() {
    setFilters(defaultFilters);
    setSort("tier");
    setPage(1);
  }

  function clearEventScope() {
    setFilters((current) => ({ ...current, eventSlug: null }));
    setPage(1);
  }

  const activeEventSlug = filters.eventSlug?.trim() ?? "";
  const activeEventContext =
    activeEventSlug !== ""
      ? {
          slug: activeEventSlug,
          name: eventContext?.name ?? null,
        }
      : null;

  return (
    <section className="space-y-4">
      <PageHeader
        title="Sponsor Search"
        description="Find and connect with sponsors that fit your event."
      />

      <div className={explorerPageGridClass}>
        <div className="hidden md:block">
          <FilterPanel
            filters={filters}
            industries={industries}
            eventName={activeEventContext?.name ?? null}
            onChange={setFilters}
            onReset={handleReset}
            className={explorerFilterStickyClass}
          />
        </div>

        <div className="space-y-4">
          {activeEventContext ? (
            <SponsorEventContextBanner
              eventName={activeEventContext.name}
              onClear={clearEventScope}
            />
          ) : null}
          <ExplorerResultsToolbar
            total={filteredAndSorted.length}
            entityLabel="sponsors"
            sort={sort}
            sortOptions={SPONSOR_SORT_OPTIONS}
            onSortChange={setSort}
            onOpenFilters={() => setMobileFiltersOpen(true)}
          />
          <SponsorList
            sponsors={filteredAndSorted}
            loading={false}
            onReset={handleReset}
            page={page}
            onPageChange={setPage}
          />
        </div>
      </div>

      <MobileFilterDrawer
        open={mobileFiltersOpen}
        onClose={() => setMobileFiltersOpen(false)}
      >
        <FilterPanel
          filters={filters}
          industries={industries}
          eventName={activeEventContext?.name ?? null}
          onChange={setFilters}
          onReset={handleReset}
        />
      </MobileFilterDrawer>
    </section>
  );
}
