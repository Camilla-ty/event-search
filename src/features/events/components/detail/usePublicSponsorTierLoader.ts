"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { PublicSponsorTierPageResult } from "@/src/features/events/server/publicSponsorRoster";

import type { EventSponsorRow } from "./types";

export const PUBLIC_SPONSOR_TIER_LOAD_ERROR_MESSAGE =
  "Couldn't load sponsors for this tier.";

export type PublicSponsorTierLoadState = {
  tierRank: number;
  status: "loading" | "loading-more" | "idle" | "error";
  rows: EventSponsorRow[];
  page: number;
  totalInTier: number;
  totalPages: number;
  hasMore: boolean;
  errorMessage: string | null;
};

/**
 * Loads one tier at a time, one 20-row page per request (ADR-003 Phase 4).
 * Only the currently open tier is kept in state; switching tiers aborts the
 * in-flight request and discards previous rows. Stale responses (superseded
 * requestId or aborted signal) never mutate state.
 */
export function usePublicSponsorTierLoader(
  editionId: string,
  initialTier1Page: PublicSponsorTierPageResult,
) {
  const initialTierState = useCallback(
    (): PublicSponsorTierLoadState => ({
      tierRank: 1,
      status: "idle",
      rows: initialTier1Page.rows,
      page: initialTier1Page.page,
      totalInTier: initialTier1Page.totalInTier,
      totalPages: initialTier1Page.totalPages,
      hasMore: initialTier1Page.hasMore,
      errorMessage: null,
    }),
    [initialTier1Page],
  );
  const [openTier, setOpenTier] = useState<PublicSponsorTierLoadState | null>(
    initialTierState,
  );
  const openTierRef = useRef<PublicSponsorTierLoadState | null>(openTier);
  const requestIdRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);

  const updateOpenTier = useCallback(
    (next: PublicSponsorTierLoadState | null) => {
      openTierRef.current = next;
      setOpenTier(next);
    },
    [],
  );

  const abortInFlight = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  /** Discard the open tier's rows and cancel any in-flight request. */
  const reset = useCallback(() => {
    abortInFlight();
    requestIdRef.current += 1;
    updateOpenTier(null);
  }, [abortInFlight, updateOpenTier]);

  const requestPage = useCallback(
    (
      tierRank: number,
      page: number,
      mode: "open" | "load-more",
      previous: PublicSponsorTierLoadState | null,
    ) => {
      abortInFlight();
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      const controller = new AbortController();
      controllerRef.current = controller;

      updateOpenTier(
        mode === "open"
          ? {
              tierRank,
              status: "loading",
              rows: [],
              page: 0,
              totalInTier: 0,
              totalPages: 1,
              hasMore: false,
              errorMessage: null,
            }
          : {
              ...(previous as PublicSponsorTierLoadState),
              status: "loading-more",
              errorMessage: null,
            },
      );

      const isStale = () =>
        requestIdRef.current !== requestId || controller.signal.aborted;

      void (async () => {
        try {
          const response = await fetch(
            `/api/events/${encodeURIComponent(editionId)}/sponsors?tier_rank=${tierRank}&page=${page}`,
            {
              signal: controller.signal,
              headers: { accept: "application/json" },
            },
          );
          if (isStale()) return;

          if (!response.ok) {
            const current = openTierRef.current;
            if (current?.tierRank !== tierRank) return;
            updateOpenTier({
              ...current,
              status: "error",
              errorMessage: PUBLIC_SPONSOR_TIER_LOAD_ERROR_MESSAGE,
            });
            return;
          }

          const payload = (await response.json()) as PublicSponsorTierPageResult;
          if (
            isStale() ||
            payload.tierRank !== tierRank ||
            payload.page !== page ||
            openTierRef.current?.tierRank !== tierRank
          ) {
            return;
          }

          const currentRows = openTierRef.current.rows;
          updateOpenTier({
            tierRank,
            status: "idle",
            rows:
              mode === "load-more"
                ? [...currentRows, ...(Array.isArray(payload.rows) ? payload.rows : [])]
                : Array.isArray(payload.rows)
                  ? payload.rows
                  : [],
            page: payload.page,
            totalInTier: payload.totalInTier,
            totalPages: payload.totalPages,
            hasMore: payload.hasMore,
            errorMessage: null,
          });
        } catch {
          if (isStale()) return;
          const current = openTierRef.current;
          if (current?.tierRank !== tierRank) return;
          updateOpenTier({
            ...current,
            status: "error",
            errorMessage: PUBLIC_SPONSOR_TIER_LOAD_ERROR_MESSAGE,
          });
        }
      })();
    },
    [abortInFlight, editionId, updateOpenTier],
  );

  const loadTier = useCallback(
    (tierRank: number) => {
      requestPage(tierRank, 1, "open", null);
    },
    [requestPage],
  );

  const loadMore = useCallback(() => {
    const current = openTierRef.current;
    if (
      current === null ||
      current.page < 1 ||
      !current.hasMore ||
      current.status === "loading" ||
      current.status === "loading-more"
    ) {
      return;
    }
    requestPage(current.tierRank, current.page + 1, "load-more", current);
  }, [requestPage]);

  const retry = useCallback(() => {
    const current = openTierRef.current;
    if (current?.status !== "error") return;
    if (current.page === 0) {
      loadTier(current.tierRank);
      return;
    }
    loadMore();
  }, [loadMore, loadTier]);

  const restoreInitialTier = useCallback(() => {
    abortInFlight();
    requestIdRef.current += 1;
    updateOpenTier(initialTierState());
  }, [abortInFlight, initialTierState, updateOpenTier]);

  return {
    openTier,
    loadTier,
    loadMore,
    retry,
    reset,
    restoreInitialTier,
  };
}
