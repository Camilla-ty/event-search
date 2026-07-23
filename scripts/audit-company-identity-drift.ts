/**
 * READ-ONLY audit: Company Identity Phase 1 legacy drift.
 *
 * Uses the same resolveCompanyWebsiteIdentity rules as the app.
 * Never writes.
 *
 * Run:
 *   npx tsx --env-file=.env.local scripts/audit-company-identity-drift.ts
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { resolveCompanyWebsiteIdentity } from "@/src/lib/domain/hostedPlatformWebsite";

import { createBackfillSupabaseClient } from "./backfill/core/supabase";

type Company = {
  id: string;
  name: string;
  website: string | null;
  domain: string | null;
  status: string;
};

type DomainRow = {
  id: string;
  company_id: string;
  domain: string;
  is_primary: boolean;
};

type Example = {
  id: string;
  name: string;
  website: string | null;
  domain: string | null;
  resolved?: string | null;
  detail?: string;
};

const ARTIFACTS_DIR = join(process.cwd(), "scripts", "artifacts", "company-identity-phase1");
const RUN_TS = new Date().toISOString().replace(/[:.]/g, "-");

async function fetchAll<T>(
  supabase: ReturnType<typeof createBackfillSupabaseClient>,
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

function hostOfIdentity(identity: string): string {
  return identity.split("/")[0] ?? identity;
}

function platformBucket(identityOrHost: string): string {
  const host = hostOfIdentity(identityOrHost.toLowerCase());
  if (host === "facebook.com" || host === "fb.com" || host === "m.facebook.com") {
    return "facebook";
  }
  if (host === "linkedin.com") return "linkedin";
  if (host === "x.com" || host === "twitter.com") return "x";
  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be") {
    return "youtube";
  }
  if (host === "opensea.io") return "opensea";
  if (host === "magiceden.io") return "magiceden";
  if (host === "mirror.xyz") return "mirror";
  if (host === "t.me" || host === "telegram.me") return "telegram";
  if (host.endsWith(".substack.com") || host === "substack.com") return "substack";
  if (host.endsWith(".medium.com") || host === "medium.com") return "medium";
  if (host.endsWith(".github.io")) return "github_pages";
  if (host.includes(".")) return "corporate_or_other";
  return "other";
}

function bump(
  counts: Record<string, Record<string, number>>,
  cat: string,
  platform: string,
) {
  counts[cat] ??= {};
  counts[cat][platform] = (counts[cat][platform] ?? 0) + 1;
}

async function main(): Promise<void> {
  console.log("[company-identity Phase 1 audit] READ-ONLY");

  const supabase = createBackfillSupabaseClient();
  const companies = await fetchAll<Company>(
    supabase,
    "companies",
    "id, name, website, domain, status",
  );
  const domainRows = await fetchAll<DomainRow>(
    supabase,
    "company_domains",
    "id, company_id, domain, is_primary",
  );

  const active = companies.filter((c) => c.status === "active");
  const domainsByCompany = new Map<string, DomainRow[]>();
  for (const row of domainRows) {
    const list = domainsByCompany.get(row.company_id) ?? [];
    list.push(row);
    domainsByCompany.set(row.company_id, list);
  }

  const identityOwners = new Map<string, string[]>();
  function claim(identity: string, companyId: string) {
    const key = identity.trim().toLowerCase();
    if (!key) return;
    const list = identityOwners.get(key) ?? [];
    if (!list.includes(companyId)) list.push(companyId);
    identityOwners.set(key, list);
  }
  for (const c of active) {
    if (c.domain?.trim()) claim(c.domain, c.id);
  }
  for (const row of domainRows) {
    claim(row.domain, row.company_id);
  }

  const cat1: Example[] = [];
  const cat2: Example[] = [];
  const cat3: Example[] = [];
  const cat4: Example[] = [];
  const cat5: Example[] = [];
  const cat6: Example[] = [];
  const cat7: Example[] = [];
  const platformCounts: Record<string, Record<string, number>> = {};

  const cat1Ids = new Set<string>();
  const cat2Ids = new Set<string>();
  const cat3Ids = new Set<string>();
  const cat4Ids = new Set<string>();
  const cat5Ids = new Set<string>();
  const cat6Ids = new Set<string>();
  const cat7Ids = new Set<string>();

  for (const c of active) {
    const rows = domainsByCompany.get(c.id) ?? [];
    const primaries = rows.filter((r) => r.is_primary);
    const website = c.website?.trim() ?? "";
    const storedDomain = c.domain?.trim() || null;

    if (primaries.length > 1) {
      cat5Ids.add(c.id);
      bump(platformCounts, "5_multi_primary", "n/a");
      if (cat5.length < 10) {
        cat5.push({
          id: c.id,
          name: c.name,
          website: c.website,
          domain: c.domain,
          detail: `primary_count=${primaries.length}; ${primaries.map((p) => p.domain).join(" | ")}`,
        });
      }
    }

    if (website !== "") {
      const identity = resolveCompanyWebsiteIdentity(website);
      if (identity.status === "domain") {
        const resolved = identity.domain;
        const resolvedKey = resolved.toLowerCase();
        const platform = platformBucket(resolved);

        if (!storedDomain) {
          cat1Ids.add(c.id);
          bump(platformCounts, "1_website_identity_domain_null", platform);
          if (cat1.length < 15) {
            cat1.push({
              id: c.id,
              name: c.name,
              website: c.website,
              domain: c.domain,
              resolved,
            });
          }
        } else if (storedDomain.toLowerCase() !== resolvedKey) {
          cat2Ids.add(c.id);
          bump(platformCounts, "2_website_identity_domain_mismatch", platform);
          if (cat2.length < 15) {
            cat2.push({
              id: c.id,
              name: c.name,
              website: c.website,
              domain: c.domain,
              resolved,
            });
          }
        }

        const owners = (identityOwners.get(resolvedKey) ?? []).filter((id) => id !== c.id);
        if (owners.length > 0) {
          cat6Ids.add(c.id);
          bump(platformCounts, "6_identity_conflict", platform);
          if (cat6.length < 15) {
            cat6.push({
              id: c.id,
              name: c.name,
              website: c.website,
              domain: c.domain,
              resolved,
              detail: `foreign_owner_count=${owners.length}`,
            });
          }
        }
      } else {
        cat7Ids.add(c.id);
        let platform = "unparseable";
        if (identity.status === "no_identity") {
          try {
            const withProtocol = website.startsWith("http")
              ? website
              : `https://${website}`;
            const u = new URL(withProtocol);
            platform = platformBucket(u.hostname.replace(/^www\./i, ""));
          } catch {
            platform = "unparseable_host";
          }
          bump(platformCounts, "7_no_identity", platform);
        } else {
          bump(platformCounts, "7_unparseable", platform);
        }
        if (cat7.length < 15) {
          cat7.push({
            id: c.id,
            name: c.name,
            website: c.website,
            domain: c.domain,
            resolved: null,
            detail: identity.status,
          });
        }
      }
    }

    if (storedDomain) {
      const matchingPrimary = primaries.find(
        (r) => r.domain.trim().toLowerCase() === storedDomain.toLowerCase(),
      );
      if (!matchingPrimary) {
        cat3Ids.add(c.id);
        bump(platformCounts, "3_missing_primary_for_domain", platformBucket(storedDomain));
        if (cat3.length < 15) {
          cat3.push({
            id: c.id,
            name: c.name,
            website: c.website,
            domain: c.domain,
            detail: `primaries=${primaries.map((p) => p.domain).join("|") || "none"}`,
          });
        }
      }
    }

    if (primaries.length === 1) {
      const primaryDomain = primaries[0]!.domain.trim();
      const primaryKey = primaryDomain.toLowerCase();
      const companyKey = storedDomain?.toLowerCase() ?? null;
      if (companyKey !== primaryKey) {
        cat4Ids.add(c.id);
        bump(platformCounts, "4_primary_differs_from_domain", platformBucket(primaryDomain));
        if (cat4.length < 15) {
          cat4.push({
            id: c.id,
            name: c.name,
            website: c.website,
            domain: c.domain,
            detail: `primary=${primaryDomain}`,
          });
        }
      }
    }
  }

  const repairableByPlatform: Record<string, number> = {};
  const repairableSample: Example[] = [];
  let repairableCount = 0;
  let conflictSkipCount = 0;
  let multiPrimarySkip = 0;
  const conflictSample: Example[] = [];

  for (const c of active) {
    const website = c.website?.trim() ?? "";
    if (!website) continue;
    const identity = resolveCompanyWebsiteIdentity(website);
    if (identity.status !== "domain") continue;
    const resolved = identity.domain;
    const resolvedKey = resolved.toLowerCase();
    const storedDomain = c.domain?.trim() || null;
    const rows = domainsByCompany.get(c.id) ?? [];
    const primaries = rows.filter((r) => r.is_primary);
    const matchingPrimary = primaries.find(
      (r) => r.domain.trim().toLowerCase() === resolvedKey,
    );
    const needsDomainFix =
      !storedDomain || storedDomain.toLowerCase() !== resolvedKey;
    const needsPrimaryFix = !matchingPrimary;
    if (!needsDomainFix && !needsPrimaryFix) continue;

    if (primaries.length > 1) {
      multiPrimarySkip++;
      continue;
    }

    const owners = (identityOwners.get(resolvedKey) ?? []).filter((id) => id !== c.id);
    if (owners.length > 0) {
      conflictSkipCount++;
      if (conflictSample.length < 15) {
        conflictSample.push({
          id: c.id,
          name: c.name,
          website: c.website,
          domain: c.domain,
          resolved,
          detail: `owned_by=${owners.join(",")}`,
        });
      }
      continue;
    }

    repairableCount++;
    const p = platformBucket(resolved);
    repairableByPlatform[p] = (repairableByPlatform[p] ?? 0) + 1;
    if (repairableSample.length < 20) {
      repairableSample.push({
        id: c.id,
        name: c.name,
        website: c.website,
        domain: c.domain,
        resolved,
      });
    }
  }

  const report = {
    generated_at: new Date().toISOString(),
    totals: {
      companies_all: companies.length,
      companies_active: active.length,
      company_domains_rows: domainRows.length,
    },
    category_counts: {
      "1_website_identity_domain_null": cat1Ids.size,
      "2_website_identity_domain_mismatch": cat2Ids.size,
      "3_domain_without_matching_primary": cat3Ids.size,
      "4_primary_differs_from_companies_domain": cat4Ids.size,
      "5_multiple_primary_rows": cat5Ids.size,
      "6_resolved_identity_owned_elsewhere": cat6Ids.size,
      "7_no_identity_or_unparseable": cat7Ids.size,
    },
    platform_breakdown: platformCounts,
    auto_repair_plan: {
      repairable_count: repairableCount,
      repairable_by_platform: repairableByPlatform,
      skipped_identity_conflicts: conflictSkipCount,
      skipped_multi_primary: multiPrimarySkip,
    },
    examples: {
      cat1: cat1,
      cat2: cat2,
      cat3: cat3,
      cat4: cat4,
      cat5: cat5,
      cat6: cat6,
      cat7: cat7,
      repairable_sample: repairableSample,
      conflict_sample: conflictSample,
    },
  };

  mkdirSync(ARTIFACTS_DIR, { recursive: true });
  const outPath = join(ARTIFACTS_DIR, `audit-${RUN_TS}.json`);
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log(`[wrote] ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
