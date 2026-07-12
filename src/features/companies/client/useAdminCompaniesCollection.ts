"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { fetchAdminCompaniesCollection } from "@/src/features/companies/client/fetchAdminCompaniesCollection";
import {
  applyCompaniesListFilterChange,
  applyCompaniesListSearchChange,
  buildCompaniesListParamsKey,
  parseCompaniesListParamsFromLocationSearch,
  shouldApplyCompaniesListFetchResult,
} from "@/src/features/companies/client/companiesListCollectionState";
import type { AdminCompaniesCollectionResult } from "@/src/features/companies/server/adminCompaniesCollection";
import { buildCompaniesListSearchParams } from "@/src/features/companies/server/companiesListParams";
import type { CompaniesListParams } from "@/src/features/companies/server/companiesListParams";
import type { CompanyListFilter } from "@/src/features/companies/server/companyAdmin";
import {
  readSearchParamsFromWindow,
  replaceHistoryUrl,
} from "@/src/lib/navigation/historyUrl";
import { canOwnerSyncHistoryUrl } from "@/src/lib/navigation/useUrlSyncedState";
import { buildPathWithSearchParams } from "@/src/lib/navigation/urlPath";

type AdminCompaniesCollectionState = {
  companies: AdminCompaniesCollectionResult["companies"];
  total: AdminCompaniesCollectionResult["total"];
};

export type UseAdminCompaniesCollectionResult = AdminCompaniesCollectionState & {
  params: CompaniesListParams;
  isLoading: boolean;
  error: string | null;
  setFilter: (filter: CompanyListFilter) => void;
  submitSearch: (search: string) => void;
  clearSearch: () => void;
};

function buildCompaniesHref(pathname: string, params: CompaniesListParams): string {
  return buildPathWithSearchParams(pathname, buildCompaniesListSearchParams(params));
}

export function useAdminCompaniesCollection(
  initial: AdminCompaniesCollectionResult,
): UseAdminCompaniesCollectionResult {
  const pathname = usePathname();
  const [params, setParams] = useState<CompaniesListParams>(initial.params);
  const [collection, setCollection] = useState<AdminCompaniesCollectionState>({
    companies: initial.companies,
    total: initial.total,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const lastFetchedParamsKeyRef = useRef(buildCompaniesListParamsKey(initial.params));
  const suppressFetchRef = useRef(true);
  const suppressUrlRef = useRef(false);
  const ownerPathnameRef = useRef(pathname);

  const initialParamsKey = buildCompaniesListParamsKey(initial.params);

  useEffect(() => {
    suppressFetchRef.current = true;
    suppressUrlRef.current = true;
    lastFetchedParamsKeyRef.current = initialParamsKey;
    setParams(initial.params);
    setCollection({
      companies: initial.companies,
      total: initial.total,
    });
    setError(null);
    setIsLoading(false);
  }, [initial.companies, initial.params, initial.total, initialParamsKey]);

  useEffect(() => {
    function handlePopState() {
      if (!canOwnerSyncHistoryUrl(ownerPathnameRef.current)) {
        return;
      }

      const parsed = parseCompaniesListParamsFromLocationSearch(readSearchParamsFromWindow());
      suppressUrlRef.current = true;
      setParams(parsed);
    }

    globalThis.addEventListener("popstate", handlePopState);
    return () => globalThis.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const ownerPathname = ownerPathnameRef.current;
    if (!canOwnerSyncHistoryUrl(ownerPathname)) {
      return;
    }

    if (suppressUrlRef.current) {
      suppressUrlRef.current = false;
      return;
    }

    const nextHref = buildCompaniesHref(ownerPathname, params);
    const currentHref = buildPathWithSearchParams(ownerPathname, readSearchParamsFromWindow());
    if (nextHref === currentHref) {
      return;
    }

    replaceHistoryUrl(nextHref);
  }, [params]);

  useEffect(() => {
    const paramsKey = buildCompaniesListParamsKey(params);

    if (suppressFetchRef.current) {
      suppressFetchRef.current = false;
      lastFetchedParamsKeyRef.current = paramsKey;
      return;
    }

    if (paramsKey === lastFetchedParamsKeyRef.current) {
      return;
    }

    const requestId = ++requestIdRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    fetchAdminCompaniesCollection(params, controller.signal)
      .then((result) => {
        if (!shouldApplyCompaniesListFetchResult(requestId, requestIdRef.current)) {
          return;
        }

        const resultKey = buildCompaniesListParamsKey(result.params);
        lastFetchedParamsKeyRef.current = resultKey;
        suppressFetchRef.current = true;

        setCollection({
          companies: result.companies,
          total: result.total,
        });
        setParams(result.params);
      })
      .catch((fetchError: unknown) => {
        if (!shouldApplyCompaniesListFetchResult(requestId, requestIdRef.current)) {
          return;
        }
        if (fetchError instanceof Error && fetchError.name === "AbortError") {
          return;
        }

        const message =
          fetchError instanceof Error ? fetchError.message : "Failed to load companies.";
        setError(message);
      })
      .finally(() => {
        if (shouldApplyCompaniesListFetchResult(requestId, requestIdRef.current)) {
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [params]);

  const setFilter = useCallback((filter: CompanyListFilter) => {
    setParams((current) => applyCompaniesListFilterChange(current, filter));
  }, []);

  const submitSearch = useCallback((search: string) => {
    setParams((current) => applyCompaniesListSearchChange(current, search));
  }, []);

  const clearSearch = useCallback(() => {
    setParams((current) => applyCompaniesListSearchChange(current, ""));
  }, []);

  return {
    companies: collection.companies,
    total: collection.total,
    params,
    isLoading,
    error,
    setFilter,
    submitSearch,
    clearSearch,
  };
}
