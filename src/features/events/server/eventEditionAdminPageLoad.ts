import type { CityOption } from "@/src/features/companies/server/getCityOptions";
import { getCityOptions } from "@/src/features/companies/server/getCityOptions";
import type { LiveSponsorRow } from "@/src/features/events/components/admin/liveSponsorTypes";
import type { EventEditionAdminRow } from "@/src/features/events/server/eventEditionAdmin";
import {
  countLiveSponsorsForEdition,
  getEventEditionAdminById,
  getLiveSponsorsForEditionAdmin,
} from "@/src/features/events/server/eventEditionAdmin";
import type { SeriesOption } from "@/src/features/events/server/getSeriesOptions";
import { getSeriesOptions } from "@/src/features/events/server/getSeriesOptions";
import type { KeywordRow } from "@/src/features/events/server/seriesKeywordsAdmin";
import { getInheritedKeywordsForEditionId } from "@/src/features/events/server/seriesKeywordsAdmin";
import type { LiveExhibitorRow } from "@/src/features/exhibitors/server/eventExhibitorAdmin";
import { getLiveExhibitorsForEditionAdmin } from "@/src/features/exhibitors/server/eventExhibitorAdmin";
import type { EditionImportContext as ExhibitorEditionImportContext } from "@/src/features/exhibitor-import/server/importUiData";
import { getEditionImportsData as getExhibitorEditionImportsData } from "@/src/features/exhibitor-import/server/importUiData";
import type { EditionOrganizerAdminRow } from "@/src/features/organizers/server/eventOrganizerAdmin";
import { getOrganizersForEditionAdmin } from "@/src/features/organizers/server/eventOrganizerAdmin";
import type { EditionImportContext } from "@/src/features/sponsor-import/server/importUiData";
import { getEditionImportsData } from "@/src/features/sponsor-import/server/importUiData";

export type AdminEditionPanelKey =
  | "cities"
  | "series"
  | "sponsorCount"
  | "sponsors"
  | "exhibitors"
  | "exhibitorImports"
  | "organizers"
  | "imports"
  | "keywords";

export type AdminEditionRequiredLoadResult = {
  edition: EventEditionAdminRow | null;
  loadError: string | null;
};

export type AdminEditionOptionalPanels = {
  cities: CityOption[];
  series: SeriesOption[];
  liveSponsorCount: number;
  sponsors: LiveSponsorRow[];
  exhibitors: LiveExhibitorRow[];
  exhibitorImportsData: ExhibitorEditionImportContext;
  organizers: EditionOrganizerAdminRow[];
  importsData: EditionImportContext;
  inheritedKeywords: KeywordRow[];
  panelErrors: Partial<Record<AdminEditionPanelKey, string>>;
};

export function formatAdminEditionLoadError(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }
  return "Could not load edition data.";
}

function logAdminEditionLoadFailure(context: string, error: unknown): void {
  if (process.env.NODE_ENV !== "development") return;
  console.error(`[admin-edition] load failed (${context}):`, error);
}

function emptyEditionImportsData(edition: EventEditionAdminRow): EditionImportContext {
  return {
    editionId: edition.id,
    editionName: edition.name,
    seriesName: edition.event_series?.name ?? "—",
    liveSponsorCount: 0,
    activeBatch: null,
    batches: [],
  };
}

function emptyExhibitorEditionImportsData(
  edition: EventEditionAdminRow,
): ExhibitorEditionImportContext {
  return {
    editionId: edition.id,
    editionName: edition.name,
    seriesName: edition.event_series?.name ?? "—",
    liveExhibitorCount: 0,
    activeBatch: null,
    batches: [],
  };
}

async function resolveOptionalPanelLoad<T>(
  key: AdminEditionPanelKey,
  load: () => Promise<T>,
  fallback: T,
  panelErrors: Partial<Record<AdminEditionPanelKey, string>>,
): Promise<T> {
  try {
    return await load();
  } catch (error) {
    logAdminEditionLoadFailure(key, error);
    panelErrors[key] = formatAdminEditionLoadError(error);
    return fallback;
  }
}

/** Required edition header — never throws; returns loadError when Supabase is unreachable. */
export async function loadAdminEditionRequired(
  editionId: string,
): Promise<AdminEditionRequiredLoadResult> {
  try {
    const edition = await getEventEditionAdminById(editionId);
    if (!edition) {
      return { edition: null, loadError: null };
    }
    return { edition, loadError: null };
  } catch (error) {
    logAdminEditionLoadFailure("edition lookup", error);
    return { edition: null, loadError: formatAdminEditionLoadError(error) };
  }
}

/** Optional tab/panel data — never throws; records per-panel errors instead. */
export async function loadAdminEditionOptionalPanels(
  edition: EventEditionAdminRow,
): Promise<AdminEditionOptionalPanels> {
  const panelErrors: Partial<Record<AdminEditionPanelKey, string>> = {};
  const editionId = edition.id;

  const [
    cities,
    series,
    liveSponsorCount,
    sponsors,
    exhibitors,
    exhibitorImportsData,
    organizers,
    importsData,
    inheritedKeywords,
  ] = await Promise.all([
    resolveOptionalPanelLoad("cities", () => getCityOptions(), [], panelErrors),
    resolveOptionalPanelLoad("series", () => getSeriesOptions(), [], panelErrors),
    resolveOptionalPanelLoad(
      "sponsorCount",
      () => countLiveSponsorsForEdition(editionId),
      0,
      panelErrors,
    ),
    resolveOptionalPanelLoad(
      "sponsors",
      () => getLiveSponsorsForEditionAdmin(editionId),
      [],
      panelErrors,
    ),
    resolveOptionalPanelLoad(
      "exhibitors",
      () => getLiveExhibitorsForEditionAdmin(editionId),
      [],
      panelErrors,
    ),
    resolveOptionalPanelLoad(
      "exhibitorImports",
      () =>
        getExhibitorEditionImportsData(
          editionId,
          edition.name,
          edition.event_series?.name ?? "—",
          0,
        ),
      emptyExhibitorEditionImportsData(edition),
      panelErrors,
    ),
    resolveOptionalPanelLoad(
      "organizers",
      () => getOrganizersForEditionAdmin(editionId),
      [],
      panelErrors,
    ),
    resolveOptionalPanelLoad(
      "imports",
      () =>
        getEditionImportsData(
          editionId,
          edition.name,
          edition.event_series?.name ?? "—",
          0,
        ),
      emptyEditionImportsData(edition),
      panelErrors,
    ),
    resolveOptionalPanelLoad(
      "keywords",
      () => getInheritedKeywordsForEditionId(editionId),
      [],
      panelErrors,
    ),
  ]);

  importsData.liveSponsorCount = liveSponsorCount;
  exhibitorImportsData.liveExhibitorCount = exhibitors.length;

  return {
    cities,
    series,
    liveSponsorCount,
    sponsors,
    exhibitors,
    exhibitorImportsData,
    organizers,
    importsData,
    inheritedKeywords,
    panelErrors,
  };
}

export function adminEditionPanelErrorMessage(
  panelErrors: Partial<Record<AdminEditionPanelKey, string>>,
  key: AdminEditionPanelKey,
): string | null {
  const message = panelErrors[key];
  return typeof message === "string" && message.trim() !== "" ? message.trim() : null;
}

export const ADMIN_EDITION_PANEL_LABELS: Record<AdminEditionPanelKey, string> = {
  cities: "City options",
  series: "Series options",
  sponsorCount: "Live sponsor count",
  sponsors: "Live sponsors",
  exhibitors: "Exhibitors",
  exhibitorImports: "Exhibitor import history",
  organizers: "Organizers",
  imports: "Import history",
  keywords: "Inherited keywords",
};

export function summarizeAdminEditionPanelErrors(
  panelErrors: Partial<Record<AdminEditionPanelKey, string>>,
): string | null {
  const parts: string[] = [];
  for (const [key, message] of Object.entries(panelErrors) as Array<
    [AdminEditionPanelKey, string | undefined]
  >) {
    if (typeof message !== "string" || message.trim() === "") continue;
    parts.push(`${ADMIN_EDITION_PANEL_LABELS[key]}: ${message.trim()}`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}
