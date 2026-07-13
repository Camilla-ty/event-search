"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import {
  applyEventExplorerFiltersChange,
  applyEventExplorerPageChange,
  applyEventExplorerQueryChangeToParams,
  applyEventExplorerReset,
  applyEventExplorerSortChange,
  buildEventExplorerParamsKey,
  parseEventExplorerParamsFromLocationSearch,
  shouldApplyEventExplorerFetchResult,
} from "@/src/features/events/client/eventExplorerCollectionState";
import { fetchEventExplorerCollection } from "@/src/features/events/client/fetchEventExplorerCollection";
import type { EventFilters } from "@/src/features/events/components/explorer/types";
import type { EventExplorerFilterFacets } from "@/src/features/events/lib/eventExplorerFilterFacets";
import type { EventExplorerSortMode } from "@/src/features/events/lib/eventExplorerOrdering";
import { buildEventExplorerCollectionSearchParams } from "@/src/features/events/server/eventExplorerParams";
import type { EventExplorerParams } from "@/src/features/events/server/eventExplorerParams";
import type {
  EventExplorerPageResult,
  EventExplorerRow,
} from "@/src/features/events/server/eventExplorerTypes";
import {
  readSearchParamsFromWindow,
  replaceHistoryUrl,
} from "@/src/lib/navigation/historyUrl";
import { canOwnerSyncHistoryUrl } from "@/src/lib/navigation/useUrlSyncedState";
import { buildPathWithSearchParams } from "@/src/lib/navigation/urlPath";

type EventExplorerCollectionState = {
  rows: EventExplorerRow[];
  total: number;
  facets: EventExplorerFilterFacets;
  activeTopic: EventExplorerPageResult["activeTopic"];
  topicUnknown: boolean;
};

export type UseEventExplorerCollectionResult = EventExplorerCollectionState & {
  params: EventExplorerParams;
  isLoading: boolean;
  error: string | null;
  setFilters: (
    value: EventFilters | ((prev: EventFilters) => EventFilters),
  ) => void;
  setSort: (sort: EventExplorerSortMode) => void;
  setPage: (page: number) => void;
  setQuery: (query: string) => void;
  resetAll: () => void;
};

function buildExplorerHref(pathname: string, params: EventExplorerParams): string {
  return buildPathWithSearchParams(pathname, buildEventExplorerCollectionSearchParams(params));
}

export function useEventExplorerCollection(
  initial: EventExplorerPageResult,
): UseEventExplorerCollectionResult {
  const pathname = usePathname();
  const [params, setParams] = useState<EventExplorerParams>(initial.params);
  const [collection, setCollection] = useState<EventExplorerCollectionState>({
    rows: initial.rows,
    total: initial.total,
    facets: initial.facets,
    activeTopic: initial.activeTopic,
    topicUnknown: initial.topicUnknown,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const lastFetchedParamsKeyRef = useRef(buildEventExplorerParamsKey(initial.params));
  const suppressFetchRef = useRef(true);
  const suppressUrlRef = useRef(false);
  const ownerPathnameRef = useRef(pathname);

  const initialParamsKey = buildEventExplorerParamsKey(initial.params);

  useEffect(() => {
    suppressFetchRef.current = true;
    suppressUrlRef.current = true;
    lastFetchedParamsKeyRef.current = initialParamsKey;
    setParams(initial.params);
    setCollection({
      rows: initial.rows,
      total: initial.total,
      facets: initial.facets,
      activeTopic: initial.activeTopic,
      topicUnknown: initial.topicUnknown,
    });
    setError(null);
    setIsLoading(false);
  }, [
    initial.activeTopic,
    initial.facets,
    initial.params,
    initial.rows,
    initial.topicUnknown,
    initial.total,
    initialParamsKey,
  ]);

  useEffect(() => {
    function handlePopState() {
      if (!canOwnerSyncHistoryUrl(ownerPathnameRef.current)) {
        return;
      }

      const parsed = parseEventExplorerParamsFromLocationSearch(
        readSearchParamsFromWindow(),
      );
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

    const nextHref = buildExplorerHref(ownerPathname, params);
    const currentHref = buildPathWithSearchParams(ownerPathname, readSearchParamsFromWindow());
    if (nextHref === currentHref) {
      return;
    }

    replaceHistoryUrl(nextHref);
  }, [params]);

  useEffect(() => {
    const paramsKey = buildEventExplorerParamsKey(params);

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

    fetchEventExplorerCollection(params, controller.signal)
      .then((result) => {
        if (!shouldApplyEventExplorerFetchResult(requestId, requestIdRef.current)) {
          return;
        }

        const resultKey = buildEventExplorerParamsKey(result.params);
        lastFetchedParamsKeyRef.current = resultKey;
        suppressFetchRef.current = true;

        setCollection({
          rows: result.rows,
          total: result.total,
          facets: result.facets,
          activeTopic: result.activeTopic,
          topicUnknown: result.topicUnknown,
        });
        setParams(result.params);
      })
      .catch((fetchError: unknown) => {
        if (!shouldApplyEventExplorerFetchResult(requestId, requestIdRef.current)) {
          return;
        }
        if (fetchError instanceof Error && fetchError.name === "AbortError") {
          return;
        }

        const message =
          fetchError instanceof Error ? fetchError.message : "Failed to load events.";
        setError(message);
      })
      .finally(() => {
        if (shouldApplyEventExplorerFetchResult(requestId, requestIdRef.current)) {
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [params]);

  const setFilters = useCallback(
    (value: EventFilters | ((prev: EventFilters) => EventFilters)) => {
      setParams((current) => {
        const nextFilters = typeof value === "function" ? value(current.filters) : value;
        return applyEventExplorerFiltersChange(current, nextFilters);
      });
    },
    [],
  );

  const setSort = useCallback((sort: EventExplorerSortMode) => {
    setParams((current) => applyEventExplorerSortChange(current, sort));
  }, []);

  const setPage = useCallback((page: number) => {
    setParams((current) => applyEventExplorerPageChange(current, page));
  }, []);

  const setQuery = useCallback((query: string) => {
    setParams((current) => applyEventExplorerQueryChangeToParams(current, query));
  }, []);

  const resetAll = useCallback(() => {
    setParams(applyEventExplorerReset());
  }, []);

  return {
    rows: collection.rows,
    total: collection.total,
    facets: collection.facets,
    activeTopic: collection.activeTopic,
    topicUnknown: collection.topicUnknown,
    params,
    isLoading,
    error,
    setFilters,
    setSort,
    setPage,
    setQuery,
    resetAll,
  };
}
