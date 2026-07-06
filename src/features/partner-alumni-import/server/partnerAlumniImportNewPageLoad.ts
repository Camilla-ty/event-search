import { getVersionImportContext, type VersionImportContext } from "./importUiData";
import { getActiveBatchForVersion } from "./partnerAlumniImportAdmin";

export type PartnerAlumniImportNewPageData = {
  versionContext: VersionImportContext;
  activeBatchId: string | null;
};

export type PartnerAlumniImportNewPageLoaders = {
  getVersionImportContext: typeof getVersionImportContext;
  getActiveBatchForVersion: typeof getActiveBatchForVersion;
};

const defaultLoaders: PartnerAlumniImportNewPageLoaders = {
  getVersionImportContext,
  getActiveBatchForVersion,
};

export async function loadPartnerAlumniImportNewPage(
  params: { seriesId: string; versionId: string },
  loaders: PartnerAlumniImportNewPageLoaders = defaultLoaders,
): Promise<PartnerAlumniImportNewPageData | null> {
  const scope = { seriesId: params.seriesId, versionId: params.versionId };

  const versionContext = await loaders.getVersionImportContext(
    params.seriesId,
    params.versionId,
  );
  if (!versionContext) return null;

  const activeBatch = await loaders.getActiveBatchForVersion(scope);

  return {
    versionContext,
    activeBatchId: activeBatch ? String(activeBatch.id) : null,
  };
}
