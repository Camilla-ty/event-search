/**
 * Plan repair of company_domains left on merged tombstones.
 * Moves rows to merged_into_company_id; syncs primary to canonical companies.domain.
 */

export type MergedDomainOrphanRow = {
  id: string;
  company_id: string;
  domain: string;
  is_primary: boolean;
};

export type MergedOrphanRepairDecision =
  | {
      status: "repair";
      mergedCompanyId: string;
      mergedName: string;
      canonicalCompanyId: string;
      canonicalName: string;
      identity: string;
      domainRowId: string;
      action: "move_as_alias" | "move_and_set_primary" | "delete_overlap";
      reason: string;
    }
  | {
      status: "skipped_conflict";
      mergedCompanyId: string;
      mergedName: string;
      canonicalCompanyId: string | null;
      identity: string;
      domainRowId: string;
      reason: string;
      ownerCompanyId?: string;
    }
  | {
      status: "skipped_no_canonical";
      mergedCompanyId: string;
      mergedName: string;
      identity: string;
      domainRowId: string;
      reason: string;
    };

function normalizeKey(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized === "" ? null : normalized;
}

/**
 * Plan a single orphaned domain row on a merged company.
 * `foreignOwnersOfIdentity` excludes the merged company and its canonical.
 */
export function planMergedCompanyDomainOrphanRepair(input: {
  mergedCompanyId: string;
  mergedName: string;
  canonicalCompanyId: string | null;
  canonicalName: string | null;
  canonicalDomain: string | null;
  orphan: MergedDomainOrphanRow;
  canonicalAlreadyHasIdentity: boolean;
  foreignOwnersOfIdentity: readonly { company_id: string }[];
}): MergedOrphanRepairDecision {
  const identity = input.orphan.domain.trim();
  const identityKey = normalizeKey(identity);
  if (!identityKey) {
    return {
      status: "skipped_conflict",
      mergedCompanyId: input.mergedCompanyId,
      mergedName: input.mergedName,
      canonicalCompanyId: input.canonicalCompanyId,
      identity,
      domainRowId: input.orphan.id,
      reason: "Blank identity on merged company_domains row.",
    };
  }

  if (!input.canonicalCompanyId) {
    return {
      status: "skipped_no_canonical",
      mergedCompanyId: input.mergedCompanyId,
      mergedName: input.mergedName,
      identity,
      domainRowId: input.orphan.id,
      reason: "Merged company has no merged_into_company_id.",
    };
  }

  if (input.foreignOwnersOfIdentity.length > 0) {
    return {
      status: "skipped_conflict",
      mergedCompanyId: input.mergedCompanyId,
      mergedName: input.mergedName,
      canonicalCompanyId: input.canonicalCompanyId,
      identity,
      domainRowId: input.orphan.id,
      reason: "Identity owned by a third company.",
      ownerCompanyId: input.foreignOwnersOfIdentity[0]?.company_id,
    };
  }

  if (input.canonicalAlreadyHasIdentity) {
    return {
      status: "repair",
      mergedCompanyId: input.mergedCompanyId,
      mergedName: input.mergedName,
      canonicalCompanyId: input.canonicalCompanyId,
      canonicalName: input.canonicalName ?? "",
      identity,
      domainRowId: input.orphan.id,
      action: "delete_overlap",
      reason: "Canonical already has this identity; drop tombstone duplicate row.",
    };
  }

  const canonicalPrimaryKey = normalizeKey(input.canonicalDomain);
  if (canonicalPrimaryKey === identityKey) {
    return {
      status: "repair",
      mergedCompanyId: input.mergedCompanyId,
      mergedName: input.mergedName,
      canonicalCompanyId: input.canonicalCompanyId,
      canonicalName: input.canonicalName ?? "",
      identity,
      domainRowId: input.orphan.id,
      action: "move_and_set_primary",
      reason: "Identity matches canonical companies.domain; move and set primary.",
    };
  }

  return {
    status: "repair",
    mergedCompanyId: input.mergedCompanyId,
    mergedName: input.mergedName,
    canonicalCompanyId: input.canonicalCompanyId,
    canonicalName: input.canonicalName ?? "",
    identity,
    domainRowId: input.orphan.id,
    action: "move_as_alias",
    reason: "Move tombstone identity to canonical as alias.",
  };
}
