export type {
  ImportMatchShadowBatchSummary,
  ImportMatchShadowPersistedDecision,
  ImportMatchShadowRowInput,
} from "@/src/lib/companies/importMatchShadow/types";

export {
  assertImportMatchShadowEqual,
  assertImportMatchShadowRowsEqual,
} from "@/src/lib/companies/importMatchShadow/compare";

export {
  runImportMatchShadowRow,
  type ShadowLiveOverlays,
} from "@/src/lib/companies/importMatchShadow/runShadowRow";

export {
  shadowCompareAgainstCatalog,
  shadowCompareImportMatchRows,
  type ImportMatchShadowCompareResult,
} from "@/src/lib/companies/importMatchShadow/runShadowBatch";

export { loadFullDirectoryCatalogForShadow } from "@/src/lib/companies/importMatchShadow/loadFullDirectoryCatalog";

export {
  listRecentImportBatchesForShadow,
  loadImportBatchForShadow,
  loadPartnerAlumniBulkShadowRowsFromImportBatch,
} from "@/src/lib/companies/importMatchShadow/loadRealBatches";

export {
  runRealBatchImportMatchShadow,
  type RealBatchShadowReport,
} from "@/src/lib/companies/importMatchShadow/runRealBatchShadow";
