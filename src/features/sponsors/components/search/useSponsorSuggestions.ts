"use client";

import { useEffect, useState } from "react";

import {
  isSponsorDiscoverySuggestQueryEligible,
  SPONSOR_SUGGEST_DEFAULT_LIMIT,
  SPONSOR_SUGGEST_MIN_QUERY_LENGTH,
} from "@/src/features/sponsors/server/sponsorDiscoverySuggestParams";
import type {
  SponsorSuggestItem,
  SponsorSuggestResult,
} from "@/src/features/sponsors/server/sponsorDiscoverySuggestTypes";

export const SPONSOR_SUGGEST_DEBOUNCE_MS = 275;

function readSuggestItem(raw: unknown): SponsorSuggestItem | null {
  if (raw === null || typeof raw !== "object") return null;

  const row = raw as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id.trim() : "";
  const slug = typeof row.slug === "string" ? row.slug.trim() : "";
  const name = typeof row.name === "string" ? row.name.trim() : "";
  if (id === "" || slug === "" || name === "") return null;

  return {
    id,
    slug,
    name,
    domain: typeof row.domain === "string" ? row.domain : null,
    logo_url: typeof row.logo_url === "string" ? row.logo_url : null,
  };
}

function parseSuggestResponse(raw: unknown): SponsorSuggestResult | null {
  if (raw === null || typeof raw !== "object") return null;

  const payload = raw as Record<string, unknown>;
  if (typeof payload.query !== "string") return null;
  if (typeof payload.total !== "number" || !Number.isFinite(payload.total)) return null;
  if (!Array.isArray(payload.items)) return null;

  const items: SponsorSuggestItem[] = [];
  for (const itemRaw of payload.items) {
    const item = readSuggestItem(itemRaw);
    if (item !== null) {
      items.push(item);
    }
  }

  return {
    query: payload.query,
    items,
    total: Math.max(0, Math.trunc(payload.total)),
  };
}

export type UseSponsorSuggestionsState = {
  trimmedQuery: string;
  eligible: boolean;
  items: SponsorSuggestItem[];
  total: number;
  loading: boolean;
  error: boolean;
  fetched: boolean;
};

export function useSponsorSuggestions(query: string): UseSponsorSuggestionsState {
  const trimmedQuery = query.trim();
  const eligible = isSponsorDiscoverySuggestQueryEligible(trimmedQuery);

  const [items, setItems] = useState<SponsorSuggestItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (!eligible) {
      setItems([]);
      setTotal(0);
      setLoading(false);
      setError(false);
      setFetched(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(false);

    const timer = window.setTimeout(() => {
      setItems([]);
      setTotal(0);

      void (async () => {
        try {
          const params = new URLSearchParams({
            q: trimmedQuery,
            limit: String(SPONSOR_SUGGEST_DEFAULT_LIMIT),
          });
          const response = await fetch(`/api/sponsors/suggest?${params.toString()}`, {
            signal: controller.signal,
            cache: "no-store",
          });

          if (!response.ok) {
            throw new Error(`Suggest request failed (${response.status})`);
          }

          const parsed = parseSuggestResponse(await response.json());
          if (parsed === null) {
            throw new Error("Invalid suggest response");
          }

          if (controller.signal.aborted) return;

          setItems(parsed.items);
          setTotal(parsed.total);
          setError(false);
        } catch (fetchError) {
          if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
            return;
          }
          if (controller.signal.aborted) return;
          setItems([]);
          setTotal(0);
          setError(true);
        } finally {
          if (!controller.signal.aborted) {
            setLoading(false);
            setFetched(true);
          }
        }
      })();
    }, SPONSOR_SUGGEST_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [eligible, trimmedQuery]);

  return {
    trimmedQuery,
    eligible,
    items,
    total,
    loading,
    error,
    fetched,
  };
}

export { SPONSOR_SUGGEST_MIN_QUERY_LENGTH };
