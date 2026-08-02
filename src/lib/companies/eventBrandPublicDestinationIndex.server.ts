import { cache } from "react";

import {
  buildEventBrandPublicDestinationIndexFromRows,
  type EventBrandPublicDestinationIndex,
  type EventBrandPublicDestinationRow,
} from "@/src/lib/companies/eventBrandPublicDestinationIndex";
import { createClient } from "@/src/lib/supabase/server";

/**
 * Loads approved Event Brand Companies and their reverse same-brand Series.
 * Reads `event_brand_public_destinations` via the session client (no service_role).
 * Approval set is intentionally small (manual allowlist); safe per request.
 *
 * Server-only: do not import from Client Components.
 */
export async function loadEventBrandPublicDestinationIndex(): Promise<EventBrandPublicDestinationIndex> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("event_brand_public_destinations")
      .select(
        "company_id, approved_at, series_id, series_slug, series_name, series_lifecycle_status",
      );

    if (error) {
      if (process.env.NODE_ENV === "development") {
        console.error(
          "[event-brand] destination index load failed:",
          error.message,
        );
      }
      return new Map();
    }

    return buildEventBrandPublicDestinationIndexFromRows(
      (data ?? []) as EventBrandPublicDestinationRow[],
    );
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[event-brand] destination index load failed:", error);
    }
    return new Map();
  }
}

/** Dedupes index loads within a single React server request. */
export const getEventBrandPublicDestinationIndex = cache(
  loadEventBrandPublicDestinationIndex,
);
