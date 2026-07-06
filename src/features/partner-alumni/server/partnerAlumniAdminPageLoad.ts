import type { PartnerAlumniAdminData } from "@/src/features/partner-alumni/server/partnerAlumniAdmin";
import { getPartnerAlumniAdminBySeriesId } from "@/src/features/partner-alumni/server/partnerAlumniAdmin";

export const EMPTY_PARTNER_ALUMNI_ADMIN_DATA: PartnerAlumniAdminData = {
  program: null,
  versions: [],
  selected_version: null,
};

export type PartnerAlumniAdminPageLoadResult = {
  data: PartnerAlumniAdminData;
  loadError: string | null;
};

export function formatPartnerAlumniLoadError(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }
  return "Could not load Partner Alumni data.";
}

function logPartnerAlumniAdminPageLoadFailure(error: unknown): void {
  if (process.env.NODE_ENV !== "development") return;
  console.error("[partner-alumni] admin page load failed:", error);
}

/** Never throws — used by admin series RSC so the rest of the page still renders. */
export async function resolvePartnerAlumniAdminPageLoad(
  load: () => Promise<PartnerAlumniAdminData>,
): Promise<PartnerAlumniAdminPageLoadResult> {
  try {
    return { data: await load(), loadError: null };
  } catch (error) {
    logPartnerAlumniAdminPageLoadFailure(error);
    return {
      data: EMPTY_PARTNER_ALUMNI_ADMIN_DATA,
      loadError: formatPartnerAlumniLoadError(error),
    };
  }
}

export async function loadPartnerAlumniAdminForSeriesPage(
  seriesId: string,
): Promise<PartnerAlumniAdminPageLoadResult> {
  return resolvePartnerAlumniAdminPageLoad(() => getPartnerAlumniAdminBySeriesId(seriesId));
}
