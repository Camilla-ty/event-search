import {
  createCompany,
  enrichCompanyLogo,
} from "@/src/features/companies/server/createCompanyWithLogo";
import type { PartnerAlumniBulkInputRow } from "@/src/features/partner-alumni/lib/parsePartnerAlumniBulkSpreadsheet";
import {
  resolvePartnerAlumniBulkDisplayOrders,
  sortPartnerAlumniBulkCommitEntries,
} from "@/src/features/partner-alumni/lib/partnerAlumniBulkDisplayOrder";
import { shouldCreateCompanyOnPartnerAlumniBulkImport } from "@/src/features/partner-alumni/lib/partnerAlumniBulkDefaults";
import {
  assertVersionBelongsToSeries,
  getPartnerAlumniAdminBySeriesId,
  type PartnerAlumniAdminData,
} from "@/src/features/partner-alumni/server/partnerAlumniAdmin";
import {
  createCompanyResolutionCaches,
  findExistingCompanyId,
  uniqueSlug,
} from "@/src/features/sponsor-import/server/materializeCompanies";
import {
  normalizeCompanyNameKey,
  parseCompanyAliasesFromRow,
} from "@/src/lib/companies/companyAliases";
import {
  buildImportMatchContext,
  matchImportRowIdentity,
  type ImportMatchContext,
  type ImportMatchMethod,
} from "@/src/lib/companies/companyImportMatching";
import { normalizeDomainFromWebsite } from "@/src/lib/domain/normalizeDomain";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { fetchAllPaginatedSupabaseRows } from "@/src/lib/supabase/fetchAllPaginatedRows";

export type PartnerAlumniBulkPreviewStatus =
  | "matched"
  | "review"
  | "create_new"
  | "on_roster"
  | "duplicate_in_file"
  | "invalid";

export type PartnerAlumniBulkPreviewRow = {
  row_number: number;
  name: string;
  website: string | null;
  display_order: number | null;
  status: PartnerAlumniBulkPreviewStatus;
  match_method: ImportMatchMethod | null;
  proposed_company_id: string | null;
  proposed_company_name: string | null;
  conflict_type: "multiple_candidates" | "domain_name_mismatch" | null;
  message: string | null;
};

export type PartnerAlumniBulkCommitRow = {
  row_number: number;
  action: "import" | "skip";
  company_id?: string | null;
  create_new?: boolean;
  name: string;
  website?: string | null;
  display_order?: number | null;
};

export type PartnerAlumniBulkCommitSummary = {
  imported: number;
  skipped: number;
  created_companies: number;
  already_on_roster: number;
};

const INSERT_CHUNK_SIZE = 100;

type CompanyDirectoryRow = {
  id: unknown;
  name: unknown;
  domain: unknown;
  website: unknown;
  aliases: unknown;
};

type CompanyDomainDirectoryRow = {
  company_id: unknown;
  domain: unknown;
};

async function loadImportMatchContext(): Promise<{
  matchContext: ImportMatchContext;
  companyNameById: ReadonlyMap<string, string>;
}> {
  const supabase = createAdminClient();
  const [companies, companyDomains] = await Promise.all([
    fetchAllPaginatedSupabaseRows<CompanyDirectoryRow>(async ({ from, to }) =>
      supabase
        .from("companies")
        .select("id, name, domain, website, aliases")
        .eq("status", "active")
        .range(from, to),
    ),
    fetchAllPaginatedSupabaseRows<CompanyDomainDirectoryRow>(async ({ from, to }) =>
      supabase.from("company_domains").select("company_id, domain").range(from, to),
    ),
  ]);

  const importCompanies = companies.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    domain: typeof row.domain === "string" ? row.domain.trim().toLowerCase() : null,
    website: typeof row.website === "string" ? row.website.trim() : null,
    aliases: parseCompanyAliasesFromRow(row.aliases),
  }));

  const companyNameById = new Map(importCompanies.map((company) => [company.id, company.name]));

  const importCompanyDomains = companyDomains
    .map((row) => ({
      company_id: String(row.company_id),
      domain: typeof row.domain === "string" ? row.domain.trim().toLowerCase() : "",
    }))
    .filter((entry) => entry.domain !== "");

  return {
    matchContext: buildImportMatchContext(importCompanies, importCompanyDomains),
    companyNameById,
  };
}

function normalizeWebsiteDomain(website: string | null): string | null {
  if (website === null || website.trim() === "") return null;
  try {
    const domain = normalizeDomainFromWebsite(website.trim());
    return domain !== "" ? domain.trim().toLowerCase() : null;
  } catch {
    return null;
  }
}

function rowIdentityKey(name: string, domain: string | null): string {
  return `${normalizeCompanyNameKey(name)}|${domain ?? ""}`;
}

function previewRowStatus(
  decision: ReturnType<typeof matchImportRowIdentity>,
): PartnerAlumniBulkPreviewStatus {
  if (decision.status === "auto_ready" && decision.proposed_company_id) {
    return "matched";
  }
  if (decision.proposed_company_id) {
    return "review";
  }
  return "create_new";
}

async function loadVersionRosterCompanyIds(versionId: string): Promise<Set<string>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("event_partner_alumni_version_companies")
    .select("company_id")
    .eq("event_partner_alumni_version_id", versionId);

  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((row) => String(row.company_id)));
}

async function loadVersionMemberDisplayOrders(versionId: string): Promise<number[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("event_partner_alumni_version_companies")
    .select("display_order")
    .eq("event_partner_alumni_version_id", versionId);

  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((row) => (typeof row.display_order === "number" ? row.display_order : null))
    .filter((order): order is number => order !== null);
}

export async function previewPartnerAlumniBulkImport(
  seriesId: string,
  versionId: string,
  inputRows: readonly PartnerAlumniBulkInputRow[],
): Promise<PartnerAlumniBulkPreviewRow[]> {
  await assertVersionBelongsToSeries(seriesId, versionId);

  const [{ matchContext, companyNameById }, rosterCompanyIds] = await Promise.all([
    loadImportMatchContext(),
    loadVersionRosterCompanyIds(versionId),
  ]);

  const seenIdentityKeys = new Set<string>();
  const seenCompanyIds = new Set<string>();
  const previewRows: PartnerAlumniBulkPreviewRow[] = [];

  for (const row of inputRows) {
    const trimmedName = row.name.trim();
    if (trimmedName === "") {
      previewRows.push({
        row_number: row.row_number,
        name: row.name,
        website: row.website,
        display_order: row.display_order,
        status: "invalid",
        match_method: null,
        proposed_company_id: null,
        proposed_company_name: null,
        conflict_type: null,
        message: "Company name is required.",
      });
      continue;
    }

    const normalizedDomain = normalizeWebsiteDomain(row.website);
    const identityKey = rowIdentityKey(trimmedName, normalizedDomain);
    if (seenIdentityKeys.has(identityKey)) {
      previewRows.push({
        row_number: row.row_number,
        name: trimmedName,
        website: row.website,
        display_order: row.display_order,
        status: "duplicate_in_file",
        match_method: null,
        proposed_company_id: null,
        proposed_company_name: null,
        conflict_type: null,
        message: "Duplicate row in upload file.",
      });
      continue;
    }
    seenIdentityKeys.add(identityKey);

    const decision = matchImportRowIdentity(
      {
        normalized_domain: normalizedDomain,
        normalized_website: row.website?.trim() ?? null,
        normalized_company_name: trimmedName,
      },
      matchContext,
    );

    const status = previewRowStatus(decision);
    const proposedCompanyId = decision.proposed_company_id;
    const proposedCompanyName =
      proposedCompanyId !== null
        ? (companyNameById.get(proposedCompanyId) ?? null)
        : null;

    if (proposedCompanyId !== null && seenCompanyIds.has(proposedCompanyId)) {
      previewRows.push({
        row_number: row.row_number,
        name: trimmedName,
        website: row.website,
        display_order: row.display_order,
        status: "duplicate_in_file",
        match_method: decision.match_method,
        proposed_company_id: proposedCompanyId,
        proposed_company_name: proposedCompanyName,
        conflict_type: decision.conflict_type,
        message: "Another row in this upload resolves to the same company.",
      });
      continue;
    }

    if (proposedCompanyId !== null && rosterCompanyIds.has(proposedCompanyId)) {
      previewRows.push({
        row_number: row.row_number,
        name: trimmedName,
        website: row.website,
        display_order: row.display_order,
        status: "on_roster",
        match_method: decision.match_method,
        proposed_company_id: proposedCompanyId,
        proposed_company_name: proposedCompanyName,
        conflict_type: decision.conflict_type,
        message: "Already on this version.",
      });
      continue;
    }

    if (proposedCompanyId !== null) {
      seenCompanyIds.add(proposedCompanyId);
    }

    let message: string | null = null;
    if (status === "review") {
      if (decision.conflict_type === "domain_name_mismatch") {
        message = "Domain matches a company with a different name — confirm before import.";
      } else if (decision.conflict_type === "multiple_candidates") {
        message = "Multiple catalog matches — pick a company manually.";
      } else if (decision.match_method === "exact_name" || decision.match_method === "alias") {
        message = "Name match — confirm before import.";
      } else {
        message = "Review suggested match before import.";
      }
    } else if (status === "create_new") {
      message = "No catalog match — a new company will be created on import.";
    }

    previewRows.push({
      row_number: row.row_number,
      name: trimmedName,
      website: row.website,
      display_order: row.display_order,
      status,
      match_method: decision.match_method,
      proposed_company_id: proposedCompanyId,
      proposed_company_name: proposedCompanyName,
      conflict_type: decision.conflict_type,
      message,
    });
  }

  return previewRows;
}

async function resolveCompanyIdForCommitRow(
  row: PartnerAlumniBulkCommitRow,
  caches: ReturnType<typeof createCompanyResolutionCaches>,
): Promise<{ companyId: string | null; created: boolean }> {
  const supabase = createAdminClient();
  const trimmedName = row.name.trim();
  const website = row.website?.trim() ?? "";
  const websiteOrNull = website !== "" ? website : null;

  if (row.action === "skip") {
    return { companyId: null, created: false };
  }

  if (typeof row.company_id === "string" && row.company_id.trim() !== "") {
    return { companyId: row.company_id.trim(), created: false };
  }

  if (shouldCreateCompanyOnPartnerAlumniBulkImport(row)) {
    const nameKey = normalizeCompanyNameKey(trimmedName);
    const cached = caches.createNewByNameKey.get(nameKey);
    if (cached) {
      return { companyId: cached, created: false };
    }

    const existingId = await findExistingCompanyId(supabase, trimmedName, websiteOrNull);
    if (existingId) {
      caches.createNewByNameKey.set(nameKey, existingId);
      return { companyId: existingId, created: false };
    }

    const slug = await uniqueSlug(trimmedName, supabase);
    const company = await createCompany({
      name: trimmedName,
      website: websiteOrNull,
      slug,
      city_id: null,
    });
    caches.createNewByNameKey.set(nameKey, company.id);
    if (websiteOrNull) {
      void enrichCompanyLogo(company.id, websiteOrNull);
    }
    return { companyId: company.id, created: true };
  }

  return { companyId: null, created: false };
}

export async function commitPartnerAlumniBulkImport(
  seriesId: string,
  versionId: string,
  commitRows: readonly PartnerAlumniBulkCommitRow[],
): Promise<{ data: PartnerAlumniAdminData; summary: PartnerAlumniBulkCommitSummary }> {
  await assertVersionBelongsToSeries(seriesId, versionId);

  const supabase = createAdminClient();
  const [adminData, rosterCompanyIds, existingOrders] = await Promise.all([
    getPartnerAlumniAdminBySeriesId(seriesId, { selectedVersionId: versionId }),
    loadVersionRosterCompanyIds(versionId),
    loadVersionMemberDisplayOrders(versionId),
  ]);

  const caches = createCompanyResolutionCaches();
  const summary: PartnerAlumniBulkCommitSummary = {
    imported: 0,
    skipped: 0,
    created_companies: 0,
    already_on_roster: 0,
  };

  const resolvedEntries: Array<{
    company_id: string;
    display_order: number | null;
    row_number: number;
  }> = [];
  const batchCompanyIds = new Set<string>();

  for (const row of sortPartnerAlumniBulkCommitEntries(commitRows)) {
    if (row.action === "skip") {
      summary.skipped += 1;
      continue;
    }

    const trimmedName = row.name.trim();
    if (trimmedName === "") {
      summary.skipped += 1;
      continue;
    }

    const { companyId, created } = await resolveCompanyIdForCommitRow(row, caches);
    if (companyId === null) {
      summary.skipped += 1;
      continue;
    }

    if (created) {
      summary.created_companies += 1;
    }

    if (rosterCompanyIds.has(companyId) || batchCompanyIds.has(companyId)) {
      summary.already_on_roster += 1;
      summary.skipped += 1;
      continue;
    }

    batchCompanyIds.add(companyId);
    resolvedEntries.push({
      company_id: companyId,
      display_order: row.display_order ?? null,
      row_number: row.row_number,
    });
  }

  if (resolvedEntries.length === 0) {
    return { data: adminData, summary };
  }

  const assignedOrders = resolvePartnerAlumniBulkDisplayOrders(existingOrders, resolvedEntries);
  const now = new Date().toISOString();
  const insertRows = resolvedEntries.map((entry, index) => ({
    event_partner_alumni_version_id: versionId,
    company_id: entry.company_id,
    display_order: assignedOrders[index] ?? index + 1,
    created_at: now,
    updated_at: now,
  }));

  for (let offset = 0; offset < insertRows.length; offset += INSERT_CHUNK_SIZE) {
    const chunk = insertRows.slice(offset, offset + INSERT_CHUNK_SIZE);
    const { error } = await supabase.from("event_partner_alumni_version_companies").insert(chunk);
    if (error) throw new Error(error.message);
  }

  summary.imported = insertRows.length;

  const data = await getPartnerAlumniAdminBySeriesId(seriesId, { selectedVersionId: versionId });
  return { data, summary };
}
