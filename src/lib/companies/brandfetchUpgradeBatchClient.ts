import type {
  BrandfetchUpgradeApiResponse,
  BrandfetchUpgradeBatchResult,
} from "@/src/lib/companies/brandfetchUpgradeTypes";
import { canUpgradeCompanyBrandfetchLogo } from "@/src/lib/companies/companyHasBrandfetchLogo";

export const BRANDFETCH_UPGRADE_BATCH_LIMIT = 100;

export type BrandfetchUpgradeBatchItem = {
  companyId: string;
  name: string;
  domain: string | null;
  logo_url: string | null;
  logo_source: string | null;
  logo_status: string | null;
};

export function isBrandfetchUpgradeEligible(item: BrandfetchUpgradeBatchItem): boolean {
  return canUpgradeCompanyBrandfetchLogo({
    domain: item.domain,
    logo_source: item.logo_source,
    logo_status: item.logo_status,
    logo_url: item.logo_url,
  });
}

export function eligibleBrandfetchUpgradeCompanyIds(
  items: readonly BrandfetchUpgradeBatchItem[],
  selectedIds?: ReadonlySet<string>,
): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];

  for (const item of items) {
    if (selectedIds && !selectedIds.has(item.companyId)) {
      continue;
    }
    if (!isBrandfetchUpgradeEligible(item)) {
      continue;
    }
    if (seen.has(item.companyId)) {
      continue;
    }
    seen.add(item.companyId);
    ids.push(item.companyId);
  }

  return ids;
}

export function countEligibleBrandfetchUpgrades(
  items: readonly BrandfetchUpgradeBatchItem[],
): number {
  return eligibleBrandfetchUpgradeCompanyIds(items).length;
}

export type BrandfetchUpgradeBatchRunResult =
  | ({ ok: true } & BrandfetchUpgradeBatchResult)
  | { ok: false; error: string };

export async function runBrandfetchUpgradeBatch(
  companyIds: readonly string[],
): Promise<BrandfetchUpgradeBatchRunResult> {
  if (companyIds.length === 0) {
    return { ok: true, results: [], upgraded: 0, skipped: 0, failed: 0 };
  }

  let upgraded = 0;
  let skipped = 0;
  let failed = 0;
  const results: BrandfetchUpgradeBatchResult["results"] = [];

  for (let offset = 0; offset < companyIds.length; offset += BRANDFETCH_UPGRADE_BATCH_LIMIT) {
    const chunk = companyIds.slice(offset, offset + BRANDFETCH_UPGRADE_BATCH_LIMIT);
    const response = await fetch("/api/admin/companies/brandfetch-upgrade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company_ids: chunk }),
    });

    const data = (await response.json()) as BrandfetchUpgradeApiResponse;
    if (!data.ok) {
      return { ok: false, error: data.error ?? "Brandfetch upgrade request failed." };
    }

    upgraded += data.upgraded;
    skipped += data.skipped;
    failed += data.failed;
    results.push(...data.results);
  }

  return { ok: true, results, upgraded, skipped, failed };
}
