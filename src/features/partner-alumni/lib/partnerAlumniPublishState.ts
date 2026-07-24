import type { PartnerAlumniAdminData } from "@/src/features/partner-alumni/server/partnerAlumniAdmin";

/** True when roster data exists but nothing is published via current_version_id. */
export function needsPartnerAlumniSetCurrent(data: PartnerAlumniAdminData): boolean {
  if (data.program?.current_version_id) return false;
  return data.versions.some((version) => version.member_count >= 1);
}

export function partnerAlumniSetCurrentPrompt(data: PartnerAlumniAdminData): string | null {
  if (!needsPartnerAlumniSetCurrent(data)) return null;

  const publishableCount = data.versions.filter((version) => version.member_count >= 1).length;
  if (publishableCount === 1) {
    return "Partner Alumni is hidden on public event pages until you set this version as current.";
  }

  return "Partner Alumni is hidden on public event pages until you set a version with companies as current.";
}
