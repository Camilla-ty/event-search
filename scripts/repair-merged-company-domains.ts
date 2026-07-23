/**
 * Repair company_domains left on merged tombstones after historical merges.
 *
 * Moves orphan identities to merged_into_company_id (canonical).
 * Dedupes overlaps. Syncs Primary when identity matches companies.domain.
 *
 * Safe by default (dry-run). Apply only with:
 *   MERGED_COMPANY_DOMAINS_REPAIR_APPLY=1
 *
 * Run (dry-run):
 *   npm run repair:merged-company-domains
 * Apply:
 *   MERGED_COMPANY_DOMAINS_REPAIR_APPLY=1 npm run repair:merged-company-domains
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  planMergedCompanyDomainOrphanRepair,
  type MergedOrphanRepairDecision,
} from "@/src/features/companies/server/planMergedCompanyDomainOrphanRepair";

import { createBackfillSupabaseClient } from "./backfill/core/supabase";

const APPLY = process.env.MERGED_COMPANY_DOMAINS_REPAIR_APPLY === "1";
const DRY_RUN = !APPLY;

const ARTIFACTS_DIR = join(
  process.cwd(),
  "scripts",
  "artifacts",
  "merged-company-domains-repair",
);
const RUN_TS = new Date().toISOString().replace(/[:.]/g, "-");

type CompanyRow = {
  id: string;
  name: string;
  status: string;
  domain: string | null;
  merged_into_company_id: string | null;
};

type DomainRow = {
  id: string;
  company_id: string;
  domain: string;
  is_primary: boolean;
};

async function fetchAll<T>(
  supabase: SupabaseClient,
  table: string,
  select: string,
): Promise<T[]> {
  const pageSize = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase.from(table).select(select).range(from, to);
    if (error) throw new Error(`${table}: ${error.message}`);
    const batch = (data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

function writeJsonl(name: string, rows: unknown[]): string {
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
  const path = join(ARTIFACTS_DIR, `repair-${name}-${RUN_TS}.jsonl`);
  const body = rows.map((row) => JSON.stringify(row)).join("\n");
  writeFileSync(path, rows.length > 0 ? `${body}\n` : "", "utf8");
  return path;
}

function normalizeKey(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized === "" ? null : normalized;
}

async function applyDecision(
  supabase: SupabaseClient,
  decision: Extract<MergedOrphanRepairDecision, { status: "repair" }>,
): Promise<void> {
  if (decision.action === "delete_overlap") {
    const { error } = await supabase
      .from("company_domains")
      .delete()
      .eq("id", decision.domainRowId)
      .eq("company_id", decision.mergedCompanyId);
    if (error) throw new Error(error.message);
    return;
  }

  if (decision.action === "move_as_alias") {
    const { error } = await supabase
      .from("company_domains")
      .update({
        company_id: decision.canonicalCompanyId,
        is_primary: false,
      })
      .eq("id", decision.domainRowId)
      .eq("company_id", decision.mergedCompanyId);
    if (error) throw new Error(error.message);
    return;
  }

  // move_and_set_primary
  const { error: demoteError } = await supabase
    .from("company_domains")
    .update({ is_primary: false })
    .eq("company_id", decision.canonicalCompanyId)
    .eq("is_primary", true);
  if (demoteError) throw new Error(demoteError.message);

  const { error: moveError } = await supabase
    .from("company_domains")
    .update({
      company_id: decision.canonicalCompanyId,
      is_primary: true,
    })
    .eq("id", decision.domainRowId)
    .eq("company_id", decision.mergedCompanyId);
  if (moveError) throw new Error(moveError.message);
}

async function main(): Promise<void> {
  const supabase = createBackfillSupabaseClient();

  const [companies, domains] = await Promise.all([
    fetchAll<CompanyRow>(
      supabase,
      "companies",
      "id, name, status, domain, merged_into_company_id",
    ),
    fetchAll<DomainRow>(
      supabase,
      "company_domains",
      "id, company_id, domain, is_primary",
    ),
  ]);

  const byId = new Map(companies.map((c) => [c.id, c]));
  const domainsByCompany = new Map<string, DomainRow[]>();
  for (const row of domains) {
    const list = domainsByCompany.get(row.company_id) ?? [];
    list.push(row);
    domainsByCompany.set(row.company_id, list);
  }

  const domainOwnerIndex = new Map<string, string[]>();
  for (const row of domains) {
    const key = normalizeKey(row.domain);
    if (!key) continue;
    const owners = domainOwnerIndex.get(key) ?? [];
    owners.push(row.company_id);
    domainOwnerIndex.set(key, owners);
  }

  const companyDomainOwners = new Map<string, string[]>();
  for (const company of companies) {
    if (company.status !== "active") continue;
    const key = normalizeKey(company.domain);
    if (!key) continue;
    const owners = companyDomainOwners.get(key) ?? [];
    owners.push(company.id);
    companyDomainOwners.set(key, owners);
  }

  const decisions: MergedOrphanRepairDecision[] = [];
  let planned = 0;
  let skippedConflict = 0;
  let skippedNoCanonical = 0;

  for (const company of companies) {
    if (company.status !== "merged") continue;
    const orphans = domainsByCompany.get(company.id) ?? [];
    if (orphans.length === 0) continue;

    const canonicalId = company.merged_into_company_id;
    const canonical = canonicalId ? byId.get(canonicalId) : null;
    const canonicalRows = canonicalId
      ? (domainsByCompany.get(canonicalId) ?? [])
      : [];
    const canonicalKeys = new Set(
      canonicalRows
        .map((row) => normalizeKey(row.domain))
        .filter((key): key is string => key !== null),
    );

    for (const orphan of orphans) {
      const key = normalizeKey(orphan.domain);
      const foreignOwners: { company_id: string }[] = [];
      if (key) {
        for (const ownerId of domainOwnerIndex.get(key) ?? []) {
          if (
            ownerId !== company.id &&
            ownerId !== canonicalId
          ) {
            foreignOwners.push({ company_id: ownerId });
          }
        }
        for (const ownerId of companyDomainOwners.get(key) ?? []) {
          if (
            ownerId !== company.id &&
            ownerId !== canonicalId &&
            !foreignOwners.some((o) => o.company_id === ownerId)
          ) {
            foreignOwners.push({ company_id: ownerId });
          }
        }
      }

      const decision = planMergedCompanyDomainOrphanRepair({
        mergedCompanyId: company.id,
        mergedName: company.name,
        canonicalCompanyId: canonicalId,
        canonicalName: canonical?.name ?? null,
        canonicalDomain: canonical?.domain ?? null,
        orphan,
        canonicalAlreadyHasIdentity: key ? canonicalKeys.has(key) : false,
        foreignOwnersOfIdentity: foreignOwners,
      });
      decisions.push(decision);
      if (decision.status === "repair") planned += 1;
      if (decision.status === "skipped_conflict") skippedConflict += 1;
      if (decision.status === "skipped_no_canonical") skippedNoCanonical += 1;
    }
  }

  const repairs = decisions.filter(
    (d): d is Extract<MergedOrphanRepairDecision, { status: "repair" }> =>
      d.status === "repair",
  );

  const plannedPath = writeJsonl("planned", repairs);
  const skippedPath = writeJsonl(
    "skipped",
    decisions.filter((d) => d.status !== "repair"),
  );

  let repaired = 0;
  let failed = 0;
  const failures: unknown[] = [];

  if (APPLY) {
    for (const decision of repairs) {
      try {
        await applyDecision(supabase, decision);
        repaired += 1;
      } catch (error) {
        failed += 1;
        failures.push({
          decision,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  const failedPath = writeJsonl("failed", failures);

  console.log(
    JSON.stringify(
      {
        mode: DRY_RUN ? "dry-run" : "apply",
        merged_companies: companies.filter((c) => c.status === "merged").length,
        merged_with_identities: companies.filter(
          (c) =>
            c.status === "merged" && (domainsByCompany.get(c.id) ?? []).length > 0,
        ).length,
        planned_repairs: planned,
        skipped_conflict: skippedConflict,
        skipped_no_canonical: skippedNoCanonical,
        repaired,
        failed,
        artifacts: {
          planned: plannedPath,
          skipped: skippedPath,
          failed: failedPath,
        },
      },
      null,
      2,
    ),
  );

  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
