export type { ImportMatchParityDecision, ImportMatchParityImporter } from "@/src/lib/companies/importMatchParity/types";
export {
  assertImportMatchParityEqual,
  assertImportMatchParityRowsEqual,
  collectParityDiffs,
} from "@/src/lib/companies/importMatchParity/assertParity";
export {
  assertParityAgainstGolden,
  assertParityDecision,
} from "@/src/lib/companies/importMatchParity/harness";
export { runGoldenImportMatchParity } from "@/src/lib/companies/importMatchParity/goldenReference";
export {
  PHASE0_ACTIVE_DIRECTORY,
  PHASE0_ORIGINAL_FIXTURE_IDS,
  PHASE0_PARITY_FIXTURES,
  PHASE0_REQUIRED_TAGS,
  PHASE01_REQUIRED_TAGS,
  directoryForFixture,
} from "@/src/lib/companies/importMatchParity/fixtures";
export { listImportMatchCandidateCompanyIds } from "@/src/lib/companies/importMatchParity/candidates";
