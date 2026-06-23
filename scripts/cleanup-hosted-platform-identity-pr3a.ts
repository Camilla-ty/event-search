/**
 * PR3A — minimal hosted-platform data cleanup.
 *
 * Fixes ONLY the concrete issues found in the production audit. This is not a
 * generic backfill framework: it targets marketplace-collection companies whose
 * stored `domain` is still a bare host, clears the one wrong auto-ingested
 * platform logo, and repairs hosted-platform `normalized_domain` (plus the
 * SVS -> Nekocore mis-match) in OPEN sponsor-import batches only.
 *
 * Safe by default: runs in DRY_RUN unless PR3A_APPLY=1.
 * Always writes JSONL backups of the BEFORE state before any write.
 *
 * Run (dry-run, default):
 *   npm run cleanup:hosted-platform-identity
 * Apply (after reviewing the dry-run report):
 *   PR3A_APPLY=1 npm run cleanup:hosted-platform-identity
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  isHostedPlatformWebsite,
  normalizeCompanyIdentityFromWebsite,
} from "@/src/lib/domain/hostedPlatformWebsite";

import { createBackfillSupabaseClient } from "./backfill/core/supabase";

const APPLY = process.env.PR3A_APPLY === "1";
const DRY_RUN = !APPLY;

const TERMINAL_BATCH_STATUSES = ["published", "discarded"];

const MARKETPLACE_COLLECTION_PATTERN =
  /^https?:\/\/(www\.)?(opensea\.io\/collection\/|magiceden\.io\/(marketplace|collections)\/)/i;

const ARTIFACTS_DIR = join(process.cwd(), "scripts", "artifacts", "pr3a");
const RUN_TS = new Date().toISOString().replace(/[:.]/g, "-");

type CompanyRow = {
  id: string;
  name: string | null;
  domain: string | null;
  website: string | null;
  logo_url: string | null;
  logo_source: string | null;
  logo_status: string | null;
  logo_fetched_at: string | null;
  logo_fetch_error: string | null;
};

type ImportRow = {
  id: string;
  batch_id: string;
  raw_company_name: string | null;
  raw_website: string | null;
  normalized_domain: string | null;
  proposed_company_id: string | null;
  match_method: string | null;
  match_confidence: string | null;
  status: string | null;
};

type CompanyPlan = {
  row: CompanyRow;
  newDomain: string;
  clearLogo: boolean;
  patch: Record<string, unknown>;
};

type ImportPlan = {
  row: ImportRow;
  newNormalizedDomain: string;
  clearProposedMatch: boolean;
  patch: Record<string, unknown>;
};

function writeBackup(name: string, rows: unknown[]): string {
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
  const path = join(ARTIFACTS_DIR, `pr3a-${name}-${RUN_TS}.jsonl`);
  const body = rows.map((row) => JSON.stringify(row)).join("\n");
  writeFileSync(path, rows.length > 0 ? `${body}\n` : "", "utf8");
  return path;
}

function isMarketplaceCollectionWebsite(website: string | null): boolean {
  return Boolean(website && MARKETPLACE_COLLECTION_PATTERN.test(website.trim()));
}

async function planCompanyFixes(
  supabase: ReturnType<typeof createBackfillSupabaseClient>,
): Promise<{ plans: CompanyPlan[]; skipped: string[]; collisions: string[] }> {
  const { data, error } = await supabase
    .from("companies")
    .select(
      "id, name, domain, website, logo_url, logo_source, logo_status, logo_fetched_at, logo_fetch_error",
    )
    .or(
      "website.ilike.%opensea.io/collection/%,website.ilike.%magiceden.io/marketplace/%,website.ilike.%magiceden.io/collections/%",
    );

  if (error) throw new Error(`load companies failed: ${error.message}`);

  const rows = (data ?? []) as CompanyRow[];
  const plans: CompanyPlan[] = [];
  const skipped: string[] = [];
  const collisions: string[] = [];

  for (const row of rows) {
    const website = row.website?.trim() ?? "";
    if (!isMarketplaceCollectionWebsite(website) || !isHostedPlatformWebsite(website)) {
      skipped.push(`${row.name ?? row.id}: website not a Tier-1 marketplace collection URL`);
      continue;
    }

    const desired = normalizeCompanyIdentityFromWebsite(website);
    const domainStale = desired !== "" && row.domain !== desired;

    const isManualLogo = row.logo_source?.trim().toLowerCase() === "manual";
    const hasAutoLogo =
      !isManualLogo &&
      (Boolean(row.logo_url?.trim()) ||
        (row.logo_source ?? "none") !== "none" ||
        (row.logo_status ?? "skipped") !== "skipped");

    if (!domainStale && !hasAutoLogo) {
      skipped.push(`${row.name ?? row.id}: already correct (domain + logo)`);
      continue;
    }

    const patch: Record<string, unknown> = {};
    if (domainStale) patch.domain = desired;
    if (hasAutoLogo) {
      patch.logo_url = null;
      patch.logo_source = "none";
      patch.logo_status = "skipped";
    }

    plans.push({ row, newDomain: desired, clearLogo: hasAutoLogo, patch });
  }

  // Unique(domain) guard: ensure no other company already holds a target domain.
  const targets = plans.map((p) => p.newDomain);
  if (targets.length > 0) {
    const { data: existing, error: existErr } = await supabase
      .from("companies")
      .select("id, domain")
      .in("domain", targets);
    if (existErr) throw new Error(`collision check failed: ${existErr.message}`);
    for (const hit of (existing ?? []) as Array<{ id: string; domain: string }>) {
      const owner = plans.find((p) => p.newDomain === hit.domain);
      if (owner && hit.id !== owner.row.id) {
        collisions.push(
          `target domain "${hit.domain}" already held by company ${hit.id} (would collide with ${owner.row.name ?? owner.row.id})`,
        );
      }
    }
  }

  return { plans, skipped, collisions };
}

async function planImportFixes(
  supabase: ReturnType<typeof createBackfillSupabaseClient>,
): Promise<{ plans: ImportPlan[]; skipped: number }> {
  const { data: batches, error: batchErr } = await supabase
    .from("sponsor_import_batches")
    .select("id, status");
  if (batchErr) throw new Error(`load batches failed: ${batchErr.message}`);

  const openBatchIds = ((batches ?? []) as Array<{ id: string; status: string }>)
    .filter((b) => !TERMINAL_BATCH_STATUSES.includes(b.status))
    .map((b) => b.id);

  if (openBatchIds.length === 0) return { plans: [], skipped: 0 };

  const { data, error } = await supabase
    .from("sponsor_import_rows")
    .select(
      "id, batch_id, raw_company_name, raw_website, normalized_domain, proposed_company_id, match_method, match_confidence, status",
    )
    .in("batch_id", openBatchIds)
    .not("raw_website", "is", null);
  if (error) throw new Error(`load import rows failed: ${error.message}`);

  const rows = (data ?? []) as ImportRow[];

  const hosted = rows.filter((r) => isHostedPlatformWebsite(r.raw_website?.trim() ?? ""));

  // Resolve desired identity for any proposed company so we can detect bad matches.
  const proposedIds = Array.from(
    new Set(hosted.map((r) => r.proposed_company_id).filter((v): v is string => Boolean(v))),
  );
  const proposedDesiredById = new Map<string, string>();
  if (proposedIds.length > 0) {
    const { data: companies, error: compErr } = await supabase
      .from("companies")
      .select("id, website, domain")
      .in("id", proposedIds);
    if (compErr) throw new Error(`load proposed companies failed: ${compErr.message}`);
    for (const c of (companies ?? []) as Array<{ id: string; website: string | null; domain: string | null }>) {
      const desired =
        normalizeCompanyIdentityFromWebsite(c.website?.trim() ?? "") || (c.domain ?? "");
      proposedDesiredById.set(c.id, desired);
    }
  }

  const plans: ImportPlan[] = [];
  let skipped = 0;

  for (const row of hosted) {
    const desired = normalizeCompanyIdentityFromWebsite(row.raw_website?.trim() ?? "");
    if (desired === "") {
      skipped += 1;
      continue;
    }

    const domainStale = row.normalized_domain !== desired;

    let clearProposedMatch = false;
    if (row.proposed_company_id) {
      const proposedDesired = proposedDesiredById.get(row.proposed_company_id) ?? "";
      clearProposedMatch = proposedDesired !== desired;
    }

    if (!domainStale && !clearProposedMatch) {
      skipped += 1;
      continue;
    }

    const patch: Record<string, unknown> = {};
    if (domainStale) patch.normalized_domain = desired;
    if (clearProposedMatch) {
      patch.proposed_company_id = null;
      patch.match_method = null;
      patch.match_confidence = null;
    }

    plans.push({ row, newNormalizedDomain: desired, clearProposedMatch, patch });
  }

  return { plans, skipped };
}

function printCompanyReport(plans: CompanyPlan[], skipped: string[], collisions: string[]): void {
  console.log("\n=== Operation 1+2: company identity + wrong-logo cleanup ===");
  if (plans.length === 0) {
    console.log("  (no company changes)");
  }
  for (const p of plans) {
    console.log(`  • ${p.row.name ?? p.row.id} (${p.row.id})`);
    if (p.row.domain !== p.newDomain) {
      console.log(`      domain:  "${p.row.domain}" -> "${p.newDomain}"`);
    }
    if (p.clearLogo) {
      console.log(
        `      logo:    url=${p.row.logo_url ? "set" : "null"} source="${p.row.logo_source}" status="${p.row.logo_status}" -> url=null source="none" status="skipped" (Storage object NOT deleted)`,
      );
    }
  }
  if (collisions.length > 0) {
    console.log("  ! COLLISIONS (these would be skipped on apply):");
    for (const c of collisions) console.log(`      - ${c}`);
  }
  if (skipped.length > 0) {
    console.log(`  skipped (${skipped.length}):`);
    for (const s of skipped) console.log(`      - ${s}`);
  }
}

function printImportReport(plans: ImportPlan[], skipped: number): void {
  console.log("\n=== Operation 3: open-batch hosted-platform normalized_domain + bad match ===");
  if (plans.length === 0) {
    console.log("  (no import row changes)");
  }
  for (const p of plans) {
    const bits: string[] = [];
    if (p.row.normalized_domain !== p.newNormalizedDomain) {
      bits.push(`normalized_domain "${p.row.normalized_domain}" -> "${p.newNormalizedDomain}"`);
    }
    if (p.clearProposedMatch) {
      bits.push(`clear proposed_company_id (was ${p.row.proposed_company_id})`);
    }
    console.log(
      `  • ${p.row.raw_company_name ?? p.row.id} [${p.row.status}] (${p.row.id})\n      ${bits.join("; ")}`,
    );
  }
  console.log(`  skipped hosted rows already correct: ${skipped}`);
}

function printVerificationQueries(): void {
  console.log("\n=== Verification queries (run after apply) ===");
  console.log(
    [
      "-- 1. No stale marketplace company domains remain (expect 0 rows):",
      "SELECT id, name, website, domain FROM public.companies",
      "WHERE website ~* '^(https?://)?(www\\.)?(opensea\\.io/collection/|magiceden\\.io/(marketplace|collections)/)'",
      "  AND domain = regexp_replace(regexp_replace(lower(btrim(website)),'^https?://',''),'^www\\.','') ;",
      "",
      "-- 2. Nekocore now path-aware + logo cleared:",
      "SELECT name, domain, logo_url, logo_source, logo_status FROM public.companies WHERE domain = 'opensea.io/collection/nekocore';",
      "",
      "-- 3. opensea.io bare host no longer used as a company domain (expect 0):",
      "SELECT count(*) FROM public.companies WHERE domain = 'opensea.io';",
      "",
      "-- 4. Open-batch OpenSea rows are path-aware and SVS no longer proposes Nekocore:",
      "SELECT r.raw_company_name, r.normalized_domain, r.proposed_company_id",
      "FROM public.sponsor_import_rows r JOIN public.sponsor_import_batches b ON b.id = r.batch_id",
      "WHERE b.status NOT IN ('published','discarded') AND lower(r.raw_website) LIKE '%opensea.io/collection/%';",
    ].join("\n"),
  );
}

async function main(): Promise<void> {
  console.log(`[pr3a] mode: ${DRY_RUN ? "DRY_RUN (no writes)" : "APPLY (writes enabled)"}`);

  const supabase = createBackfillSupabaseClient();

  const companyResult = await planCompanyFixes(supabase);
  const importResult = await planImportFixes(supabase);

  // Backups of BEFORE state for every row that would change.
  const companyBackupPath = writeBackup(
    "companies",
    companyResult.plans.map((p) => p.row),
  );
  const importBackupPath = writeBackup(
    "import-rows",
    importResult.plans.map((p) => p.row),
  );

  console.log("\n=== Backup files (BEFORE state) ===");
  console.log(`  companies:   ${companyBackupPath} (${companyResult.plans.length} rows)`);
  console.log(`  import rows: ${importBackupPath} (${importResult.plans.length} rows)`);

  printCompanyReport(companyResult.plans, companyResult.skipped, companyResult.collisions);
  printImportReport(importResult.plans, importResult.skipped);
  printVerificationQueries();

  if (DRY_RUN) {
    console.log("\n[pr3a] DRY_RUN complete — no writes performed. Re-run with PR3A_APPLY=1 to apply.");
    return;
  }

  console.log("\n[pr3a] APPLY — performing writes…");

  const collisionIds = new Set<string>();
  for (const c of companyResult.collisions) {
    const m = c.match(/with (.+)\)$/);
    if (m) collisionIds.add(m[1]);
  }

  let companyUpdated = 0;
  for (const p of companyResult.plans) {
    const { error } = await supabase.from("companies").update(p.patch).eq("id", p.row.id);
    if (error) {
      console.error(`  [fail] company ${p.row.id}: ${error.message}`);
      continue;
    }
    companyUpdated += 1;
    console.log(`  [ok] company ${p.row.name ?? p.row.id}`);
  }

  let importUpdated = 0;
  for (const p of importResult.plans) {
    const { error } = await supabase
      .from("sponsor_import_rows")
      .update(p.patch)
      .eq("id", p.row.id);
    if (error) {
      console.error(`  [fail] import row ${p.row.id}: ${error.message}`);
      continue;
    }
    importUpdated += 1;
    console.log(`  [ok] import row ${p.row.raw_company_name ?? p.row.id}`);
  }

  console.log(
    `\n[pr3a] APPLY complete — companies updated: ${companyUpdated}/${companyResult.plans.length}, import rows updated: ${importUpdated}/${importResult.plans.length}`,
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error("[pr3a] fatal:", message);
  process.exit(1);
});
