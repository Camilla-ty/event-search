/**
 * Company Identity Phase 1 — repair legacy domain / primary company_domains drift.
 *
 * Uses resolveCompanyWebsiteIdentity (via planCompanyIdentityPhase1Repair) as the
 * only normalizer. Preserves companies.website byte-for-byte. Never deletes aliases.
 *
 * Safe by default (dry-run). Apply only with:
 *   COMPANY_IDENTITY_PHASE1_APPLY=1
 *
 * Run (dry-run):
 *   npm run repair:company-identity-phase1
 * Apply:
 *   COMPANY_IDENTITY_PHASE1_APPLY=1 npm run repair:company-identity-phase1
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveCompanyWebsiteIdentity } from "@/src/lib/domain/hostedPlatformWebsite";

import {
  buildIdentityOwnerIndex,
  foreignOwnersForIdentity,
  planCompanyIdentityPhase1Repair,
  type Phase1RepairCompany,
  type Phase1RepairDecision,
  type Phase1RepairDomainRow,
} from "./lib/companyIdentityPhase1Repair";
import { createBackfillSupabaseClient } from "./backfill/core/supabase";

const APPLY = process.env.COMPANY_IDENTITY_PHASE1_APPLY === "1";
const DRY_RUN = !APPLY;

const ARTIFACTS_DIR = join(
  process.cwd(),
  "scripts",
  "artifacts",
  "company-identity-phase1",
);
const RUN_TS = new Date().toISOString().replace(/[:.]/g, "-");

type DomainRowWithCompany = Phase1RepairDomainRow & { company_id: string };

type Summary = {
  repaired: number;
  skipped_conflict: number;
  skipped_no_identity: number;
  skipped_unparseable: number;
  skipped_blank_website: number;
  skipped_multi_primary: number;
  unchanged: number;
  failed: number;
  planned_repairs: number;
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

async function loadLiveForeignOwners(
  supabase: SupabaseClient,
  companyId: string,
  identity: string,
): Promise<{ company_id: string }[]> {
  const key = identity.trim().toLowerCase();
  const owners = new Set<string>();

  const { data: domainCompanies, error: domainError } = await supabase
    .from("companies")
    .select("id, domain")
    .neq("id", companyId)
    .not("domain", "is", null);
  if (domainError) throw new Error(domainError.message);
  for (const row of domainCompanies ?? []) {
    const domain = typeof row.domain === "string" ? row.domain.trim().toLowerCase() : "";
    if (domain === key) owners.add(String(row.id));
  }

  const { data: domainRows, error: rowsError } = await supabase
    .from("company_domains")
    .select("company_id, domain")
    .neq("company_id", companyId);
  if (rowsError) throw new Error(rowsError.message);
  for (const row of domainRows ?? []) {
    const domain = typeof row.domain === "string" ? row.domain.trim().toLowerCase() : "";
    if (domain === key) owners.add(String(row.company_id));
  }

  return [...owners].map((company_id) => ({ company_id }));
}

async function applyRepair(
  supabase: SupabaseClient,
  decision: Extract<Phase1RepairDecision, { status: "repair" }>,
): Promise<void> {
  // Re-check conflicts immediately before writes.
  const liveForeign = await loadLiveForeignOwners(
    supabase,
    decision.companyId,
    decision.afterDomain,
  );
  if (liveForeign.length > 0) {
    throw new Error(
      `Conflict re-check failed: ${decision.afterDomain} owned by ${liveForeign
        .map((o) => o.company_id)
        .join(",")}`,
    );
  }

  if (decision.setCompanyDomain) {
    const { data: current, error: readError } = await supabase
      .from("companies")
      .select("website, domain")
      .eq("id", decision.companyId)
      .single();
    if (readError) throw new Error(readError.message);
    if (current?.website !== decision.website) {
      throw new Error(
        `Refusing to update domain: website changed underfoot for ${decision.companyId}`,
      );
    }

    const { error: updateError } = await supabase
      .from("companies")
      .update({ domain: decision.afterDomain })
      .eq("id", decision.companyId);
    if (updateError) throw new Error(updateError.message);
  }

  const action = decision.primaryAction;
  if (!action) return;

  if (action.action === "promote_existing") {
    const { error: demoteError } = await supabase
      .from("company_domains")
      .update({ is_primary: false })
      .eq("company_id", decision.companyId)
      .eq("is_primary", true);
    if (demoteError) throw new Error(demoteError.message);

    const { error: promoteError } = await supabase
      .from("company_domains")
      .update({ is_primary: true })
      .eq("id", action.domainRowId)
      .eq("company_id", decision.companyId);
    if (promoteError) throw new Error(promoteError.message);
    return;
  }

  if (action.action === "demote_then_insert" || action.action === "insert_primary") {
    if (action.action === "demote_then_insert") {
      const { error: demoteError } = await supabase
        .from("company_domains")
        .update({ is_primary: false })
        .eq("company_id", decision.companyId)
        .eq("is_primary", true);
      if (demoteError) throw new Error(demoteError.message);
    }

    const { error: insertError } = await supabase.from("company_domains").insert({
      company_id: decision.companyId,
      domain: action.domain,
      is_primary: true,
    });
    if (insertError) throw new Error(insertError.message);
  }
}

async function main(): Promise<void> {
  console.log(
    `[company-identity Phase 1 repair] mode=${DRY_RUN ? "DRY_RUN" : "APPLY"}`,
  );

  const supabase = createBackfillSupabaseClient();
  const companiesAll = await fetchAll<Phase1RepairCompany & { status: string }>(
    supabase,
    "companies",
    "id, name, website, domain, status",
  );
  const domainRows = await fetchAll<DomainRowWithCompany>(
    supabase,
    "company_domains",
    "id, company_id, domain, is_primary",
  );

  const active = companiesAll.filter((c) => c.status === "active");
  const domainsByCompany = new Map<string, Phase1RepairDomainRow[]>();
  for (const row of domainRows) {
    const list = domainsByCompany.get(row.company_id) ?? [];
    list.push({
      id: row.id,
      domain: row.domain,
      is_primary: row.is_primary === true,
    });
    domainsByCompany.set(row.company_id, list);
  }

  const ownerIndex = buildIdentityOwnerIndex({
    companies: active,
    domainRows,
  });

  const summary: Summary = {
    repaired: 0,
    skipped_conflict: 0,
    skipped_no_identity: 0,
    skipped_unparseable: 0,
    skipped_blank_website: 0,
    skipped_multi_primary: 0,
    unchanged: 0,
    failed: 0,
    planned_repairs: 0,
  };

  const beforeRows: unknown[] = [];
  const afterRows: unknown[] = [];
  const planned: unknown[] = [];
  const failures: unknown[] = [];

  for (const company of active) {
    const rows = domainsByCompany.get(company.id) ?? [];
    const website = company.website?.trim() ?? "";
    let resolvedForForeign: string | null = null;
    if (website !== "") {
      const identity = resolveCompanyWebsiteIdentity(website);
      if (identity.status === "domain") resolvedForForeign = identity.domain;
    }

    const foreign = resolvedForForeign
      ? foreignOwnersForIdentity(ownerIndex, resolvedForForeign, company.id)
      : [];

    const decision = planCompanyIdentityPhase1Repair({
      company,
      companyDomainRows: rows,
      foreignOwnersOfDesiredIdentity: foreign,
    });

    const beforeSnapshot = {
      company_id: company.id,
      name: company.name,
      website: company.website,
      domain: company.domain,
      company_domains: rows,
      decision_status: decision.status,
    };
    beforeRows.push(beforeSnapshot);

    switch (decision.status) {
      case "unchanged":
        summary.unchanged++;
        afterRows.push({ ...beforeSnapshot, result: "unchanged" });
        continue;
      case "skipped_conflict":
        summary.skipped_conflict++;
        afterRows.push({ ...beforeSnapshot, result: decision.status, reason: decision.reason });
        continue;
      case "skipped_no_identity":
        summary.skipped_no_identity++;
        afterRows.push({ ...beforeSnapshot, result: decision.status, reason: decision.reason });
        continue;
      case "skipped_unparseable":
        summary.skipped_unparseable++;
        afterRows.push({ ...beforeSnapshot, result: decision.status, reason: decision.reason });
        continue;
      case "skipped_blank_website":
        summary.skipped_blank_website++;
        afterRows.push({ ...beforeSnapshot, result: decision.status, reason: decision.reason });
        continue;
      case "skipped_multi_primary":
        summary.skipped_multi_primary++;
        afterRows.push({ ...beforeSnapshot, result: decision.status, reason: decision.reason });
        continue;
      case "repair":
        summary.planned_repairs++;
        planned.push(decision);
        break;
      default: {
        const _exhaustive: never = decision;
        throw new Error(`Unhandled decision: ${JSON.stringify(_exhaustive)}`);
      }
    }

    if (DRY_RUN) {
      afterRows.push({
        ...beforeSnapshot,
        result: "planned_repair",
        after_domain: decision.afterDomain,
        set_company_domain: decision.setCompanyDomain,
        primary_action: decision.primaryAction,
        website_preserved: decision.website,
      });
      continue;
    }

    try {
      await applyRepair(supabase, decision);
      summary.repaired++;
      afterRows.push({
        ...beforeSnapshot,
        result: "repaired",
        after_domain: decision.afterDomain,
        set_company_domain: decision.setCompanyDomain,
        primary_action: decision.primaryAction,
        website_preserved: decision.website,
      });
    } catch (error) {
      summary.failed++;
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ company_id: company.id, name: company.name, error: message });
      afterRows.push({
        ...beforeSnapshot,
        result: "failed",
        error: message,
      });
    }
  }

  const beforePath = writeJsonl("before", beforeRows);
  const afterPath = writeJsonl("after", afterRows);
  const plannedPath = writeJsonl("planned", planned);
  const failuresPath = writeJsonl("failures", failures);

  const report = {
    mode: DRY_RUN ? "dry_run" : "apply",
    generated_at: new Date().toISOString(),
    active_companies_scanned: active.length,
    summary,
    artifacts: {
      before: beforePath,
      after: afterPath,
      planned: plannedPath,
      failures: failuresPath,
    },
  };

  const reportPath = join(ARTIFACTS_DIR, `repair-summary-${RUN_TS}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log(`[wrote] ${reportPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
