import type { ImportScope } from "@/src/features/partner-alumni-import/server/partnerAlumniImportAdmin";

export function importScopeFromParams(params: {
  id: string;
  versionId: string;
}): ImportScope {
  return {
    seriesId: params.id.trim(),
    versionId: params.versionId.trim(),
  };
}
