import { useEffect, useState } from "react";

import type { MergeCompanyPickerOption } from "@/src/features/companies/components/admin/merge/mergeWizardTypes";
import { MERGE_SEARCH_MIN_CHARS } from "@/src/features/companies/components/admin/merge/mergeWizardTypes";

type CompaniesSearchApiResponse = {
  ok: boolean;
  companies?: Array<Record<string, unknown>>;
};

function mapSearchHit(raw: Record<string, unknown>): MergeCompanyPickerOption {
  return {
    id: String(raw.id),
    name: typeof raw.name === "string" ? raw.name : "—",
    slug: typeof raw.slug === "string" ? raw.slug : "",
    domain: typeof raw.domain === "string" ? raw.domain : null,
    website: typeof raw.website === "string" ? raw.website : null,
    logo_url: typeof raw.logo_url === "string" ? raw.logo_url : null,
    sponsor_link_count:
      typeof raw.sponsor_link_count === "number" && Number.isFinite(raw.sponsor_link_count)
        ? raw.sponsor_link_count
        : 0,
    matched_alias:
      typeof raw.matched_alias === "string" && raw.matched_alias.trim() !== ""
        ? raw.matched_alias
        : null,
    created_at: typeof raw.created_at === "string" ? raw.created_at : null,
  };
}

export function useCompanyAdminSearch(options: {
  excludeIds?: readonly string[];
}) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<MergeCompanyPickerOption[]>([]);
  const [lastFetchedTerm, setLastFetchedTerm] = useState("");
  const [loading, setLoading] = useState(false);

  const term = search.trim();
  const excludeKey = (options.excludeIds ?? []).join(",");

  useEffect(() => {
    const excludeIds = new Set(excludeKey === "" ? [] : excludeKey.split(","));

    if (term.length < MERGE_SEARCH_MIN_CHARS) {
      setResults([]);
      setLastFetchedTerm("");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/admin/companies?search=${encodeURIComponent(term)}`,
        );
        const data = (await res.json()) as CompaniesSearchApiResponse;
        if (cancelled) return;

        if (!data.ok || !Array.isArray(data.companies)) {
          setResults([]);
          setLastFetchedTerm(term);
          return;
        }

        const mapped = data.companies
          .map((row) => mapSearchHit(row))
          .filter((company) => !excludeIds.has(company.id));

        setResults(mapped);
        setLastFetchedTerm(term);
      } catch {
        if (!cancelled) {
          setResults([]);
          setLastFetchedTerm(term);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term, excludeKey]);

  const showNoResults =
    term.length >= MERGE_SEARCH_MIN_CHARS &&
    lastFetchedTerm === term &&
    !loading &&
    results.length === 0;

  return {
    search,
    setSearch,
    results: term.length >= MERGE_SEARCH_MIN_CHARS ? results : [],
    loading,
    showNoResults,
    term,
  };
}

export function suggestCanonicalCompanyId(
  companyA: MergeCompanyPickerOption,
  companyB: MergeCompanyPickerOption,
): string {
  if (companyA.sponsor_link_count !== companyB.sponsor_link_count) {
    return companyA.sponsor_link_count > companyB.sponsor_link_count
      ? companyA.id
      : companyB.id;
  }

  const aHasDomain = companyA.domain !== null && companyA.domain.trim() !== "";
  const bHasDomain = companyB.domain !== null && companyB.domain.trim() !== "";
  if (aHasDomain !== bHasDomain) {
    return aHasDomain ? companyA.id : companyB.id;
  }

  const aCreated = companyA.created_at ?? "";
  const bCreated = companyB.created_at ?? "";
  if (aCreated !== "" && bCreated !== "" && aCreated !== bCreated) {
    return aCreated < bCreated ? companyA.id : companyB.id;
  }

  return companyA.id;
}
