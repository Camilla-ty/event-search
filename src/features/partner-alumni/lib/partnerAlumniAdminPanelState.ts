import type {
  PartnerAlumniAdminData,
  PartnerAlumniVersionDetail,
  PartnerAlumniVersionSummary,
} from "@/src/features/partner-alumni/server/partnerAlumniAdmin";

export type PartnerAlumniVersionHeaderFormSource = Pick<
  PartnerAlumniVersionSummary,
  "version_label" | "recognition_label" | "primary_source_url" | "source_checked_at"
>;

/** Resolve header fields for the client-selected version from admin payload. */
export function resolvePartnerAlumniHeaderFormSource(
  data: PartnerAlumniAdminData,
  selectedVersionId: string | null,
): PartnerAlumniVersionHeaderFormSource | null {
  if (selectedVersionId === null) return null;

  if (data.selected_version?.id === selectedVersionId) {
    return data.selected_version;
  }

  return data.versions.find((version) => version.id === selectedVersionId) ?? null;
}

/**
 * Merge a server refresh into client state without dropping the selected version
 * or its loaded member roster.
 */
export function mergePartnerAlumniAdminServerRefresh(
  prev: PartnerAlumniAdminData,
  server: PartnerAlumniAdminData,
  selectedVersionId: string | null,
): PartnerAlumniAdminData {
  const activeVersionId =
    selectedVersionId ?? server.selected_version?.id ?? prev.selected_version?.id ?? null;

  let selected_version: PartnerAlumniVersionDetail | null = null;
  if (activeVersionId !== null) {
    const summary = server.versions.find((version) => version.id === activeVersionId) ?? null;
    if (summary) {
      if (prev.selected_version?.id === activeVersionId) {
        selected_version = {
          ...summary,
          members: prev.selected_version.members,
        };
      } else if (server.selected_version?.id === activeVersionId) {
        selected_version = server.selected_version;
      } else {
        selected_version = {
          ...summary,
          members: [],
        };
      }
    }
  }

  return {
    program: server.program,
    versions: server.versions,
    selected_version,
  };
}

export function partnerAlumniHeaderFormValues(
  source: PartnerAlumniVersionHeaderFormSource | null,
): {
  versionLabel: string;
  recognitionLabel: string;
  primarySourceUrl: string;
  sourceCheckedAt: string;
} {
  return {
    versionLabel: source?.version_label ?? "",
    recognitionLabel: source?.recognition_label ?? "",
    primarySourceUrl: source?.primary_source_url ?? "",
    sourceCheckedAt: isoToDateInput(source?.source_checked_at ?? null),
  };
}

export function isoToDateInput(iso: string | null): string {
  if (iso === null || iso === "") return "";
  return iso.slice(0, 10);
}

export function dateInputToIso(date: string): string | null {
  const trimmed = date.trim();
  if (trimmed === "") return null;
  const parsed = Date.parse(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}
