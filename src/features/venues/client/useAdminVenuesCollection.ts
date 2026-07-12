"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { fetchAdminVenuesCollection } from "@/src/features/venues/client/fetchAdminVenuesCollection";
import {
  applyVenuesListSearchChange,
  buildVenuesListParamsKey,
  parseVenuesListParamsFromLocationSearch,
  shouldApplyVenuesListFetchResult,
  toggleVenuesListIncludeArchived,
} from "@/src/features/venues/client/venuesListCollectionState";
import type { AdminVenuesCollectionResult } from "@/src/features/venues/server/adminVenuesCollection";
import { buildVenuesListSearchParams } from "@/src/features/venues/server/venuesListParams";
import type { VenuesListParams } from "@/src/features/venues/server/venuesListParams";
import {
  readSearchParamsFromWindow,
  replaceHistoryUrl,
} from "@/src/lib/navigation/historyUrl";
import { canOwnerSyncHistoryUrl } from "@/src/lib/navigation/useUrlSyncedState";
import { buildPathWithSearchParams } from "@/src/lib/navigation/urlPath";

type AdminVenuesCollectionState = {
  venues: AdminVenuesCollectionResult["venues"];
  total: AdminVenuesCollectionResult["total"];
};

export type UseAdminVenuesCollectionResult = AdminVenuesCollectionState & {
  params: VenuesListParams;
  isLoading: boolean;
  error: string | null;
  submitSearch: (search: string) => void;
  clearSearch: () => void;
  toggleIncludeArchived: () => void;
};

function buildVenuesHref(pathname: string, params: VenuesListParams): string {
  return buildPathWithSearchParams(pathname, buildVenuesListSearchParams(params));
}

export function useAdminVenuesCollection(
  initial: AdminVenuesCollectionResult,
): UseAdminVenuesCollectionResult {
  const pathname = usePathname();
  const [params, setParams] = useState<VenuesListParams>(initial.params);
  const [collection, setCollection] = useState<AdminVenuesCollectionState>({
    venues: initial.venues,
    total: initial.total,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const lastFetchedParamsKeyRef = useRef(buildVenuesListParamsKey(initial.params));
  const suppressFetchRef = useRef(true);
  const suppressUrlRef = useRef(false);
  const ownerPathnameRef = useRef(pathname);

  const initialParamsKey = buildVenuesListParamsKey(initial.params);

  useEffect(() => {
    suppressFetchRef.current = true;
    suppressUrlRef.current = true;
    lastFetchedParamsKeyRef.current = initialParamsKey;
    setParams(initial.params);
    setCollection({
      venues: initial.venues,
      total: initial.total,
    });
    setError(null);
    setIsLoading(false);
  }, [initial.params, initial.total, initial.venues, initialParamsKey]);

  useEffect(() => {
    function handlePopState() {
      if (!canOwnerSyncHistoryUrl(ownerPathnameRef.current)) {
        return;
      }

      const parsed = parseVenuesListParamsFromLocationSearch(readSearchParamsFromWindow());
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

    const nextHref = buildVenuesHref(ownerPathname, params);
    const currentHref = buildPathWithSearchParams(ownerPathname, readSearchParamsFromWindow());
    if (nextHref === currentHref) {
      return;
    }

    replaceHistoryUrl(nextHref);
  }, [params]);

  useEffect(() => {
    const paramsKey = buildVenuesListParamsKey(params);

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

    fetchAdminVenuesCollection(params, controller.signal)
      .then((result) => {
        if (!shouldApplyVenuesListFetchResult(requestId, requestIdRef.current)) {
          return;
        }

        const resultKey = buildVenuesListParamsKey(result.params);
        lastFetchedParamsKeyRef.current = resultKey;
        suppressFetchRef.current = true;

        setCollection({
          venues: result.venues,
          total: result.total,
        });
        setParams(result.params);
      })
      .catch((fetchError: unknown) => {
        if (!shouldApplyVenuesListFetchResult(requestId, requestIdRef.current)) {
          return;
        }
        if (fetchError instanceof Error && fetchError.name === "AbortError") {
          return;
        }

        const message =
          fetchError instanceof Error ? fetchError.message : "Failed to load venues.";
        setError(message);
      })
      .finally(() => {
        if (shouldApplyVenuesListFetchResult(requestId, requestIdRef.current)) {
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [params]);

  const submitSearch = useCallback((search: string) => {
    setParams((current) => applyVenuesListSearchChange(current, search));
  }, []);

  const clearSearch = useCallback(() => {
    setParams((current) => applyVenuesListSearchChange(current, ""));
  }, []);

  const toggleIncludeArchived = useCallback(() => {
    setParams((current) => toggleVenuesListIncludeArchived(current));
  }, []);

  return {
    venues: collection.venues,
    total: collection.total,
    params,
    isLoading,
    error,
    submitSearch,
    clearSearch,
    toggleIncludeArchived,
  };
}
