import { createAdminClient } from "@/src/lib/supabase/admin";

import {
  assertVersionBelongsToSeries,
  PartnerAlumniAdminError,
} from "@/src/features/partner-alumni/server/partnerAlumniAdmin";

export type VersionImportContext = {
  seriesId: string;
  seriesName: string;
  versionId: string;
  versionLabel: string;
  isCurrent: boolean;
  memberCount: number;
  warnings: string[];
};

function formatVersionLabel(version: {
  version_label: unknown;
  recognition_label: unknown;
  created_at: unknown;
}): string {
  if (typeof version.version_label === "string" && version.version_label.trim() !== "") {
    return version.version_label.trim();
  }
  if (
    typeof version.recognition_label === "string" &&
    version.recognition_label.trim() !== ""
  ) {
    return version.recognition_label.trim();
  }
  const createdAt = typeof version.created_at === "string" ? version.created_at : "";
  const parsed = Date.parse(createdAt);
  const dateLabel = Number.isNaN(parsed)
    ? "Version"
    : new Date(parsed).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
  return `Version · ${dateLabel}`;
}

export async function getVersionImportContext(
  seriesId: string,
  versionId: string,
): Promise<VersionImportContext | null> {
  let programAndVersion;
  try {
    programAndVersion = await assertVersionBelongsToSeries(seriesId, versionId);
  } catch (error) {
    if (error instanceof PartnerAlumniAdminError && error.status === 404) {
      return null;
    }
    throw error;
  }

  const { version } = programAndVersion;

  const supabase = createAdminClient();
  const { data: series, error: seriesError } = await supabase
    .from("event_series")
    .select("id, name")
    .eq("id", seriesId)
    .maybeSingle();

  if (seriesError) throw new Error(seriesError.message);
  if (!series) return null;

  const warnings: string[] = [];
  if (version.is_current) {
    warnings.push(
      "This is the current public version. Import adds companies to this roster — it does not auto-publish changes, but review carefully before keeping it current.",
    );
  }

  return {
    seriesId,
    seriesName: String(series.name),
    versionId,
    versionLabel: formatVersionLabel(version),
    isCurrent: version.is_current,
    memberCount: version.member_count,
    warnings,
  };
}
