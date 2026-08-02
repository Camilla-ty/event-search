import type { SupabaseClient } from "@supabase/supabase-js";

import { parseCompanyAliasesFromRow } from "@/src/lib/companies/companyAliases";
import type {
  ImportMatchCompany,
  ImportMatchCompanyDomain,
} from "@/src/lib/companies/companyImportMatching";
import { importWebsiteMatchKey } from "@/src/lib/domain/importWebsiteMatchKey";
import {
  sortImportMatchCompanies,
  sortImportMatchCompanyDomains,
} from "@/src/lib/companies/importMatchCandidateLoader/catalog";
import type { ImportMatchCandidateSource } from "@/src/lib/companies/importMatchCandidateLoader/load";
import {
  fetchAllPaginatedSupabaseRows,
  SUPABASE_DEFAULT_PAGE_SIZE,
} from "@/src/lib/supabase/fetchAllPaginatedRows";

type CompanyRow = {
  id: unknown;
  name: unknown;
  domain: unknown;
  website: unknown;
  aliases: unknown;
};

type CompanyDomainRow = {
  company_id: unknown;
  domain: unknown;
};

/** Keep PostgREST `.in()` / `.or()` filters under URL size limits. */
const FILTER_CHUNK_SIZE = 80;

function mapCompanyRow(row: CompanyRow): ImportMatchCompany {
  return {
    id: String(row.id),
    name: String(row.name),
    domain: typeof row.domain === "string" ? row.domain.trim().toLowerCase() : null,
    website: typeof row.website === "string" ? row.website.trim() : null,
    aliases: parseCompanyAliasesFromRow(row.aliases),
  };
}

function mapDomainRow(row: CompanyDomainRow): ImportMatchCompanyDomain | null {
  const domain = typeof row.domain === "string" ? row.domain.trim().toLowerCase() : "";
  if (domain === "") return null;
  return {
    company_id: String(row.company_id),
    domain,
  };
}

function chunkValues<T>(values: readonly T[], size: number): T[][] {
  if (values.length === 0) return [];
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function mapChunksSequentially<T, R>(
  values: readonly T[],
  size: number,
  mapChunk: (chunk: readonly T[]) => Promise<R[]>,
): Promise<R[]> {
  const out: R[] = [];
  for (const chunk of chunkValues(values, size)) {
    out.push(...(await mapChunk(chunk)));
  }
  return out;
}

/**
 * DB-backed candidate source (PostgREST + exact name/alias RPCs).
 * Not wired into production importers.
 * Alias/name lookups use import_match_company_ids_by_exact_*_keys (no broad alias scan).
 */
export function createSupabaseImportMatchCandidateSource(
  supabase: SupabaseClient,
): ImportMatchCandidateSource {
  return {
    async findActiveCompanyIdsByPrimaryDomains(domains) {
      const cleaned = [...new Set(domains.map((d) => d.trim().toLowerCase()).filter(Boolean))];
      if (cleaned.length === 0) return [];

      return mapChunksSequentially(cleaned, FILTER_CHUNK_SIZE, async (chunk) => {
        const rows = await fetchAllPaginatedSupabaseRows<{ id: unknown }>(
          async ({ from, to }) =>
            supabase
              .from("companies")
              .select("id")
              .eq("status", "active")
              .in("domain", [...chunk])
              .order("id", { ascending: true })
              .range(from, to),
          SUPABASE_DEFAULT_PAGE_SIZE,
        );
        return rows.map((row) => String(row.id));
      });
    },

    async findActiveCompanyIdsByVerifiedDomains(domains) {
      const cleaned = [...new Set(domains.map((d) => d.trim().toLowerCase()).filter(Boolean))];
      if (cleaned.length === 0) return [];

      const companyIds = await mapChunksSequentially(cleaned, FILTER_CHUNK_SIZE, async (chunk) => {
        const domainRows = await fetchAllPaginatedSupabaseRows<{ company_id: unknown }>(
          async ({ from, to }) =>
            supabase
              .from("company_domains")
              .select("company_id")
              .in("domain", [...chunk])
              .order("company_id", { ascending: true })
              .range(from, to),
          SUPABASE_DEFAULT_PAGE_SIZE,
        );
        return domainRows.map((row) => String(row.company_id)).filter(Boolean);
      });

      const uniqueCompanyIds = [...new Set(companyIds)];
      if (uniqueCompanyIds.length === 0) return [];

      return mapChunksSequentially(uniqueCompanyIds, FILTER_CHUNK_SIZE, async (chunk) => {
        const active = await fetchAllPaginatedSupabaseRows<{ id: unknown }>(
          async ({ from, to }) =>
            supabase
              .from("companies")
              .select("id")
              .eq("status", "active")
              .in("id", [...chunk])
              .order("id", { ascending: true })
              .range(from, to),
          SUPABASE_DEFAULT_PAGE_SIZE,
        );
        return active.map((row) => String(row.id));
      });
    },

    async findActiveCompanyIdsByExactNameKeys(nameKeys) {
      const cleaned = [...new Set(nameKeys.map((k) => k.trim().toLowerCase()).filter(Boolean))];
      if (cleaned.length === 0) return [];

      return mapChunksSequentially(cleaned, FILTER_CHUNK_SIZE, async (chunk) => {
        const { data, error } = await supabase.rpc(
          "import_match_company_ids_by_exact_name_keys",
          { p_keys: [...chunk] },
        );
        if (error) throw new Error(error.message);
        return (data ?? []).map((row: { id: unknown }) => String(row.id));
      });
    },

    async findActiveCompanyIdsByExactAliasKeys(nameKeys) {
      const cleaned = [...new Set(nameKeys.map((k) => k.trim().toLowerCase()).filter(Boolean))];
      if (cleaned.length === 0) return [];

      return mapChunksSequentially(cleaned, FILTER_CHUNK_SIZE, async (chunk) => {
        const { data, error } = await supabase.rpc(
          "import_match_company_ids_by_exact_alias_keys",
          { p_keys: [...chunk] },
        );
        if (error) throw new Error(error.message);
        return (data ?? []).map((row: { id: unknown }) => String(row.id));
      });
    },

    async findActiveCompanyIdsByWebsiteMatchKeys(websiteKeys) {
      const cleaned = [...new Set(websiteKeys.filter(Boolean))];
      if (cleaned.length === 0) return [];

      const hosts = [
        ...new Set(
          cleaned
            .map((key) => {
              if (!key.startsWith("website:")) return null;
              const rest = key.slice("website:".length);
              const slash = rest.indexOf("/");
              return slash === -1 ? rest : rest.slice(0, slash);
            })
            .filter((host): host is string => Boolean(host)),
        ),
      ];

      if (hosts.length === 0) return [];

      const want = new Set(cleaned);
      const ids = await mapChunksSequentially(hosts, Math.min(20, FILTER_CHUNK_SIZE), async (chunk) => {
        const orFilter = chunk
          .map((host) => `website.ilike.%${host.replace(/%/g, "")}%`)
          .join(",");

        const rows = await fetchAllPaginatedSupabaseRows<CompanyRow>(
          async ({ from, to }) =>
            supabase
              .from("companies")
              .select("id, name, domain, website, aliases")
              .eq("status", "active")
              .not("website", "is", null)
              .or(orFilter)
              .order("id", { ascending: true })
              .range(from, to),
          SUPABASE_DEFAULT_PAGE_SIZE,
        );

        return rows
          .map(mapCompanyRow)
          .filter((company) => {
            const website = company.website?.trim() ?? "";
            if (website === "") return false;
            const key = importWebsiteMatchKey(website);
            return key !== null && want.has(key);
          })
          .map((company) => company.id);
      });

      return [...new Set(ids)];
    },

    async findActiveCompaniesByIds(ids) {
      const cleaned = [...new Set(ids.filter(Boolean))];
      if (cleaned.length === 0) return [];

      const rows = await mapChunksSequentially(cleaned, FILTER_CHUNK_SIZE, async (chunk) =>
        fetchAllPaginatedSupabaseRows<CompanyRow>(
          async ({ from, to }) =>
            supabase
              .from("companies")
              .select("id, name, domain, website, aliases")
              .eq("status", "active")
              .in("id", [...chunk])
              .order("id", { ascending: true })
              .range(from, to),
          SUPABASE_DEFAULT_PAGE_SIZE,
        ),
      );

      return sortImportMatchCompanies(rows.map(mapCompanyRow));
    },

    async findCompanyDomainsByCompanyIds(companyIds) {
      const cleaned = [...new Set(companyIds.filter(Boolean))];
      if (cleaned.length === 0) return [];

      const rows = await mapChunksSequentially(cleaned, FILTER_CHUNK_SIZE, async (chunk) =>
        fetchAllPaginatedSupabaseRows<CompanyDomainRow>(
          async ({ from, to }) =>
            supabase
              .from("company_domains")
              .select("company_id, domain")
              .in("company_id", [...chunk])
              .order("company_id", { ascending: true })
              .order("domain", { ascending: true })
              .range(from, to),
          SUPABASE_DEFAULT_PAGE_SIZE,
        ),
      );

      return sortImportMatchCompanyDomains(
        rows
          .map(mapDomainRow)
          .filter((entry): entry is ImportMatchCompanyDomain => entry !== null),
      );
    },
  };
}
