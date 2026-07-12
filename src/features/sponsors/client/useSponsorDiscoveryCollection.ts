"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { fetchSponsorDiscoveryCollection } from "@/src/features/sponsors/client/fetchSponsorDiscoveryCollection";
import {
  applySponsorDiscoveryClearEventScope,
  applySponsorDiscoveryPageChange,
  applySponsorDiscoveryQueryChange,
  applySponsorDiscoverySortChange,
  buildSponsorDiscoveryParamsKey,
  parseSponsorDiscoveryParamsFromLocationSearch,
  shouldApplySponsorDiscoveryFetchResult,
} from "@/src/features/sponsors/client/sponsorDiscoveryCollectionState";
import { buildSponsorDiscoverySearchParams } from "@/src/features/sponsors/server/sponsorDiscoveryParams";
import type {
  SponsorDiscoveryParams,
  SponsorDiscoveryResult,
  SponsorDiscoverySort,
} from "@/src/features/sponsors/server/sponsorDiscoveryTypes";
import {
  readSearchParamsFromWindow,
  replaceHistoryUrl,
} from "@/src/lib/navigation/historyUrl";
import { canOwnerSyncHistoryUrl } from "@/src/lib/navigation/useUrlSyncedState";
import { buildPathWithSearchParams } from "@/src/lib/navigation/urlPath";

type SponsorDiscoveryCollectionState = {
  rows: SponsorDiscoveryResult["rows"];
  total: SponsorDiscoveryResult["total"];
  eventContext: SponsorDiscoveryResult["eventContext"];
  eventUnknown: SponsorDiscoveryResult["eventUnknown"];
};

export type UseSponsorDiscoveryCollectionResult = SponsorDiscoveryCollectionState & {
  params: SponsorDiscoveryParams;
  isLoading: boolean;
  error: string | null;
  setSort: (sort: SponsorDiscoverySort) => void;
  setPage: (page: number) => void;
  setQuery: (query: string) => void;
  clearEventScope: () => void;
};

function buildDiscoveryHref(pathname: string, params: SponsorDiscoveryParams): string {
  return buildPathWithSearchParams(pathname, buildSponsorDiscoverySearchParams(params));
}

export function useSponsorDiscoveryCollection(
  initial: SponsorDiscoveryResult,
): UseSponsorDiscoveryCollectionResult {
  const pathname = usePathname();
  const [params, setParams] = useState<SponsorDiscoveryParams>(initial.params);
  const [collection, setCollection] = useState<SponsorDiscoveryCollectionState>({
    rows: initial.rows,
    total: initial.total,
    eventContext: initial.eventContext,
    eventUnknown: initial.eventUnknown,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const lastFetchedParamsKeyRef = useRef(buildSponsorDiscoveryParamsKey(initial.params));
  const suppressFetchRef = useRef(true);
  const suppressUrlRef = useRef(false);
  const pageSizeRef = useRef(initial.params.pageSize);
  const ownerPathnameRef = useRef(pathname);

  const initialParamsKey = buildSponsorDiscoveryParamsKey(initial.params);

  useEffect(() => {
    suppressFetchRef.current = true;
    suppressUrlRef.current = true;
    pageSizeRef.current = initial.params.pageSize;
    lastFetchedParamsKeyRef.current = initialParamsKey;
    setParams(initial.params);
    setCollection({
      rows: initial.rows,
      total: initial.total,
      eventContext: initial.eventContext,
      eventUnknown: initial.eventUnknown,
    });
    setError(null);
    setIsLoading(false);
  }, [
    initial.eventContext,
    initial.eventUnknown,
    initial.params,
    initial.rows,
    initial.total,
    initialParamsKey,
  ]);

  useEffect(() => {
    function handlePopState() {
      if (!canOwnerSyncHistoryUrl(ownerPathnameRef.current)) {
        return;
      }

      const parsed = parseSponsorDiscoveryParamsFromLocationSearch(
        readSearchParamsFromWindow(),
        pageSizeRef.current,
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

    const nextHref = buildDiscoveryHref(ownerPathname, params);
    const currentHref = buildPathWithSearchParams(ownerPathname, readSearchParamsFromWindow());
    if (nextHref === currentHref) {
      return;
    }

    replaceHistoryUrl(nextHref);
  }, [params]);

  useEffect(() => {
    const paramsKey = buildSponsorDiscoveryParamsKey(params);

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

    fetchSponsorDiscoveryCollection(params, controller.signal)
      .then((result) => {
        if (!shouldApplySponsorDiscoveryFetchResult(requestId, requestIdRef.current)) {
          return;
        }

        const resultKey = buildSponsorDiscoveryParamsKey(result.params);
        lastFetchedParamsKeyRef.current = resultKey;
        suppressFetchRef.current = true;

        setCollection({
          rows: result.rows,
          total: result.total,
          eventContext: result.eventContext,
          eventUnknown: result.eventUnknown,
        });
        setParams(result.params);
      })
      .catch((fetchError: unknown) => {
        if (!shouldApplySponsorDiscoveryFetchResult(requestId, requestIdRef.current)) {
          return;
        }
        if (fetchError instanceof Error && fetchError.name === "AbortError") {
          return;
        }

        const message =
          fetchError instanceof Error ? fetchError.message : "Failed to load sponsors.";
        setError(message);
      })
      .finally(() => {
        if (shouldApplySponsorDiscoveryFetchResult(requestId, requestIdRef.current)) {
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [params]);

  const setSort = useCallback((sort: SponsorDiscoverySort) => {
    setParams((current) => applySponsorDiscoverySortChange(current, sort));
  }, []);

  const setPage = useCallback((page: number) => {
    setParams((current) => applySponsorDiscoveryPageChange(current, page));
  }, []);

  const setQuery = useCallback((query: string) => {
    setParams((current) => applySponsorDiscoveryQueryChange(current, query));
  }, []);

  const clearEventScope = useCallback(() => {
    setParams((current) => applySponsorDiscoveryClearEventScope(current));
  }, []);

  return {
    rows: collection.rows,
    total: collection.total,
    eventContext: collection.eventContext,
    eventUnknown: collection.eventUnknown,
    params,
    isLoading,
    error,
    setSort,
    setPage,
    setQuery,
    clearEventScope,
  };
}
