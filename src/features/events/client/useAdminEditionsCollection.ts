"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { fetchAdminEditionsCollection } from "@/src/features/events/client/fetchAdminEditionsCollection";
import {
  applyEditionsListFilterChange,
  buildEditionsListParamsKey,
  parseEditionsListParamsFromLocationSearch,
  shouldApplyEditionsListFetchResult,
} from "@/src/features/events/client/editionsListCollectionState";
import type { AdminEditionsCollectionResult } from "@/src/features/events/server/adminEditionsCollection";
import { buildEditionsListSearchParams } from "@/src/features/events/server/editionsListParams";
import type {
  EditionsListFilter,
  EditionsListParams,
} from "@/src/features/events/server/editionsListParams";
import {
  readSearchParamsFromWindow,
  replaceHistoryUrl,
} from "@/src/lib/navigation/historyUrl";
import { canOwnerSyncHistoryUrl } from "@/src/lib/navigation/useUrlSyncedState";
import { buildPathWithSearchParams } from "@/src/lib/navigation/urlPath";

type AdminEditionsCollectionState = {
  editions: AdminEditionsCollectionResult["editions"];
  total: AdminEditionsCollectionResult["total"];
};

export type UseAdminEditionsCollectionResult = AdminEditionsCollectionState & {
  params: EditionsListParams;
  isLoading: boolean;
  error: string | null;
  setFilter: (filter: EditionsListFilter) => void;
};

function buildEditionsHref(pathname: string, params: EditionsListParams): string {
  return buildPathWithSearchParams(pathname, buildEditionsListSearchParams(params));
}

export function useAdminEditionsCollection(
  initial: AdminEditionsCollectionResult,
): UseAdminEditionsCollectionResult {
  const pathname = usePathname();
  const [params, setParams] = useState<EditionsListParams>(initial.params);
  const [collection, setCollection] = useState<AdminEditionsCollectionState>({
    editions: initial.editions,
    total: initial.total,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const lastFetchedParamsKeyRef = useRef(buildEditionsListParamsKey(initial.params));
  const suppressFetchRef = useRef(true);
  const suppressUrlRef = useRef(false);
  const ownerPathnameRef = useRef(pathname);

  const initialParamsKey = buildEditionsListParamsKey(initial.params);

  useEffect(() => {
    suppressFetchRef.current = true;
    suppressUrlRef.current = true;
    lastFetchedParamsKeyRef.current = initialParamsKey;
    setParams(initial.params);
    setCollection({
      editions: initial.editions,
      total: initial.total,
    });
    setError(null);
    setIsLoading(false);
  }, [initial.editions, initial.params, initial.total, initialParamsKey]);

  useEffect(() => {
    function handlePopState() {
      if (!canOwnerSyncHistoryUrl(ownerPathnameRef.current)) {
        return;
      }

      const parsed = parseEditionsListParamsFromLocationSearch(readSearchParamsFromWindow());
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

    const nextHref = buildEditionsHref(ownerPathname, params);
    const currentHref = buildPathWithSearchParams(ownerPathname, readSearchParamsFromWindow());
    if (nextHref === currentHref) {
      return;
    }

    replaceHistoryUrl(nextHref);
  }, [params]);

  useEffect(() => {
    const paramsKey = buildEditionsListParamsKey(params);

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

    fetchAdminEditionsCollection(params, controller.signal)
      .then((result) => {
        if (!shouldApplyEditionsListFetchResult(requestId, requestIdRef.current)) {
          return;
        }

        const resultKey = buildEditionsListParamsKey(result.params);
        lastFetchedParamsKeyRef.current = resultKey;
        suppressFetchRef.current = true;

        setCollection({
          editions: result.editions,
          total: result.total,
        });
        setParams(result.params);
      })
      .catch((fetchError: unknown) => {
        if (!shouldApplyEditionsListFetchResult(requestId, requestIdRef.current)) {
          return;
        }
        if (fetchError instanceof Error && fetchError.name === "AbortError") {
          return;
        }

        const message =
          fetchError instanceof Error ? fetchError.message : "Failed to load editions.";
        setError(message);
      })
      .finally(() => {
        if (shouldApplyEditionsListFetchResult(requestId, requestIdRef.current)) {
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [params]);

  const setFilter = useCallback((filter: EditionsListFilter) => {
    setParams((current) => applyEditionsListFilterChange(current, filter));
  }, []);

  return {
    editions: collection.editions,
    total: collection.total,
    params,
    isLoading,
    error,
    setFilter,
  };
}
