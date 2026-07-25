"use client";

import { useEffect, useState } from "react";

import type { PublicSponsorSearchItem } from "@/src/features/events/server/publicSponsorSearch";
import {
  PUBLIC_SPONSOR_SEARCH_MIN_QUERY_LENGTH,
  parsePublicSponsorSearchQuery,
} from "@/src/features/events/server/publicSponsorSearchParams";

export const PUBLIC_SPONSOR_SEARCH_DEBOUNCE_MS = 275;

export type UsePublicSponsorSearchState = {
  trimmedQuery: string;
  eligible: boolean;
  items: PublicSponsorSearchItem[];
  loading: boolean;
  error: string | null;
  fetched: boolean;
};

type UsePublicSponsorSearchOptions = {
  enabled?: boolean;
};

function readSearchItem(raw: unknown): PublicSponsorSearchItem | null {
  if (raw === null || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id.trim() : "";
  const companyId =
    typeof row.company_id === "string" ? row.company_id.trim() : "";
  if (id === "" || companyId === "") return null;

  const companyRaw = row.company;
  if (companyRaw === null || typeof companyRaw !== "object") return null;
  const company = companyRaw as Record<string, unknown>;
  const name = typeof company.name === "string" ? company.name.trim() : "";
  if (name === "") return null;

  const tierLabelRaw =
    typeof row.tier_label === "string" ? row.tier_label : null;
  // Keep the stored label text; blank/whitespace-only → null (no badge).
  const tierLabel =
    tierLabelRaw !== null && tierLabelRaw.trim() !== "" ? tierLabelRaw : null;

  return {
    id,
    company_id: companyId,
    tier_rank: typeof row.tier_rank === "number" ? row.tier_rank : null,
    tier_label: tierLabel,
    display_order:
      typeof row.display_order === "number" ? row.display_order : null,
    company: {
      id: typeof company.id === "string" ? company.id : companyId,
      name,
      restricted: company.restricted === true,
      restricted_label:
        typeof company.restricted_label === "string"
          ? company.restricted_label
          : null,
      slug: typeof company.slug === "string" ? company.slug : null,
      domain: typeof company.domain === "string" ? company.domain : null,
      website: typeof company.website === "string" ? company.website : null,
      logo_url: typeof company.logo_url === "string" ? company.logo_url : null,
      logo_source:
        typeof company.logo_source === "string" ? company.logo_source : null,
      logo_status:
        typeof company.logo_status === "string" ? company.logo_status : null,
      href: typeof company.href === "string" ? company.href : null,
    },
  };
}

function parseSearchResponse(raw: unknown): {
  query: string;
  items: PublicSponsorSearchItem[];
} | null {
  if (raw === null || typeof raw !== "object") return null;
  const payload = raw as Record<string, unknown>;
  if (payload.ok !== true) return null;
  if (typeof payload.query !== "string") return null;
  if (!Array.isArray(payload.items)) return null;
  if (
    "total" in payload ||
    "hasMore" in payload ||
    "next" in payload ||
    "page" in payload
  ) {
    return null;
  }

  const items: PublicSponsorSearchItem[] = [];
  for (const itemRaw of payload.items) {
    const item = readSearchItem(itemRaw);
    if (item !== null) items.push(item);
  }

  return { query: payload.query, items };
}

export function usePublicSponsorSearch(
  editionId: string,
  query: string,
  options: UsePublicSponsorSearchOptions = {},
): UsePublicSponsorSearchState {
  const enabled = options.enabled ?? true;
  const parsed = parsePublicSponsorSearchQuery(query);
  const trimmedQuery = parsed.ok ? parsed.query : query.trim();
  const eligible =
    enabled && parsed.ok && !parsed.tooShort && editionId.trim() !== "";

  const [items, setItems] = useState<PublicSponsorSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (!eligible) {
      setItems([]);
      setLoading(false);
      setError(null);
      setFetched(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const params = new URLSearchParams({ q: trimmedQuery });
          const response = await fetch(
            `/api/events/${encodeURIComponent(editionId)}/sponsors/search?${params.toString()}`,
            {
              signal: controller.signal,
              cache: "no-store",
              headers: { accept: "application/json" },
            },
          );

          if (response.status === 401) {
            throw new Error("Authentication required.");
          }
          if (!response.ok) {
            throw new Error(`Search failed (${response.status})`);
          }

          const parsedBody = parseSearchResponse(await response.json());
          if (parsedBody === null) {
            throw new Error("Invalid search response");
          }

          if (controller.signal.aborted) return;
          setItems(parsedBody.items);
          setError(null);
        } catch (fetchError) {
          if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
            return;
          }
          if (controller.signal.aborted) return;
          setItems([]);
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : "Search failed.",
          );
        } finally {
          if (!controller.signal.aborted) {
            setLoading(false);
            setFetched(true);
          }
        }
      })();
    }, PUBLIC_SPONSOR_SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [eligible, editionId, trimmedQuery]);

  return {
    trimmedQuery,
    eligible,
    items,
    loading,
    error,
    fetched,
  };
}

export { PUBLIC_SPONSOR_SEARCH_MIN_QUERY_LENGTH };
