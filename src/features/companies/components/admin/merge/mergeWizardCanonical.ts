import type { MergeCompanyPickerOption } from "@/src/features/companies/components/admin/merge/mergeWizardTypes";
import { suggestCanonicalCompanyId } from "@/src/features/companies/components/admin/merge/useCompanyAdminSearch";

export type MergeCanonicalLock = {
  lockCanonical: boolean;
  lockDuplicate: boolean;
};

/**
 * Resolves the canonical company for step 2.
 * Locked prefill slots override sponsorship/domain heuristics.
 */
export function resolveInitialCanonicalCompanyId(
  companyA: MergeCompanyPickerOption,
  companyB: MergeCompanyPickerOption,
  locks: MergeCanonicalLock,
  suggest: (
    a: MergeCompanyPickerOption,
    b: MergeCompanyPickerOption,
  ) => string = suggestCanonicalCompanyId,
): string {
  if (locks.lockCanonical) {
    return companyA.id;
  }
  if (locks.lockDuplicate) {
    return companyA.id;
  }
  return suggest(companyA, companyB);
}

export function isCanonicalSelectionLocked(locks: MergeCanonicalLock): boolean {
  return locks.lockCanonical || locks.lockDuplicate;
}

export function canSelectCanonicalCompanyId(
  companyId: string,
  companyA: MergeCompanyPickerOption,
  companyB: MergeCompanyPickerOption,
  locks: MergeCanonicalLock,
): boolean {
  if (locks.lockCanonical) {
    return companyId === companyA.id;
  }
  if (locks.lockDuplicate) {
    return companyId === companyA.id;
  }
  return companyId === companyA.id || companyId === companyB.id;
}

export function applyCanonicalCompanyIdChange(
  requestedId: string,
  companyA: MergeCompanyPickerOption,
  companyB: MergeCompanyPickerOption,
  locks: MergeCanonicalLock,
  currentId: string,
): string {
  if (!canSelectCanonicalCompanyId(requestedId, companyA, companyB, locks)) {
    return currentId;
  }
  return requestedId;
}
