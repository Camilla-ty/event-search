import {
  companyHasBrandfetchLogo,
  isManualCompanyLogo,
} from "@/src/lib/companies/companyHasBrandfetchLogo";
import { logoMetadataPatchForBrandfetchLogoStorage } from "@/src/lib/companies/logoMetadataPatch";
import { resolveCompanyLogoDomain } from "@/src/lib/companies/resolveCompanyLogoDomain";
import type {
  BrandfetchUpgradeBatchResult,
  BrandfetchUpgradeFailureReason,
  BrandfetchUpgradeItemResult,
  BrandfetchUpgradeSkipReason,
} from "@/src/lib/companies/brandfetchUpgradeTypes";
import {
  scheduleCompanyLogoCleanupAfterPersist,
  uploadCompanyLogoBytes,
} from "@/src/features/companies/server/companyLogoStorage";
import { createAdminClient } from "@/src/lib/supabase/admin";

export type {
  BrandfetchUpgradeBatchResult,
  BrandfetchUpgradeFailureReason,
  BrandfetchUpgradeItemResult,
  BrandfetchUpgradeSkipReason,
} from "@/src/lib/companies/brandfetchUpgradeTypes";

const BRANDFETCH_API_TIMEOUT_MS = 10_000;
const DOWNLOAD_TIMEOUT_MS = 10_000;
const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;
export const BRANDFETCH_UPGRADE_MAX_BATCH_SIZE = 100;

const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/svg+xml",
  "image/gif",
];

const LOGO_TYPE_PRIORITY = ["icon", "logo", "symbol"] as const;
const FORMAT_PRIORITY = ["png", "webp", "jpeg", "jpg", "svg"] as const;
const THEME_PRIORITY = ["light", "dark"] as const;

type FetchedImage = {
  bytes: Uint8Array;
  contentType: string;
  sourceUrl: string;
};

type BrandfetchLogoFormat = {
  src: string;
  format: string;
  background?: string | null;
  size?: number | null;
  width?: number | null;
  height?: number | null;
};

type BrandfetchLogoEntry = {
  type: string;
  theme?: string | null;
  formats: BrandfetchLogoFormat[];
};

type BrandfetchBrandResponse = {
  logos?: BrandfetchLogoEntry[];
};

type CompanyUpgradeRow = {
  id: string;
  name: string;
  domain: string | null;
  logo_url: string | null;
  logo_source: string | null;
  logo_status: string | null;
};

function getBrandfetchApiKey(): string | null {
  const key = process.env.BRANDFETCH_API_KEY?.trim();
  return key ? key : null;
}

function isAllowedImageContentType(contentType: string): boolean {
  const base = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  return ALLOWED_IMAGE_TYPES.includes(base);
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response | null> {
  const { timeoutMs = DOWNLOAD_TIMEOUT_MS, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...rest,
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function downloadImage(url: string): Promise<FetchedImage | null> {
  const response = await fetchWithTimeout(url);
  if (!response || !response.ok) return null;

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!isAllowedImageContentType(contentType)) return null;

  const contentLengthHeader = response.headers.get("content-length");
  if (contentLengthHeader) {
    const length = Number(contentLengthHeader);
    if (Number.isFinite(length) && length > MAX_LOGO_SIZE_BYTES) return null;
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_LOGO_SIZE_BYTES) return null;

  return { bytes, contentType, sourceUrl: url };
}

function themeRank(theme: string | null | undefined): number {
  if (theme == null) return THEME_PRIORITY.length;
  const index = THEME_PRIORITY.indexOf(theme as (typeof THEME_PRIORITY)[number]);
  return index === -1 ? THEME_PRIORITY.length : index;
}

function pickLogoAssetUrl(brand: BrandfetchBrandResponse): string | null {
  const logos = brand.logos ?? [];
  if (logos.length === 0) return null;

  const candidates: Array<{ typeRank: number; themeRank: number; formatRank: number; src: string }> =
    [];

  for (const logo of logos) {
    const typeIndex = LOGO_TYPE_PRIORITY.indexOf(
      logo.type as (typeof LOGO_TYPE_PRIORITY)[number],
    );
    if (typeIndex === -1) continue;

    for (const format of logo.formats) {
      const formatIndex = FORMAT_PRIORITY.indexOf(
        format.format.toLowerCase() as (typeof FORMAT_PRIORITY)[number],
      );
      if (formatIndex === -1) continue;
      const src = format.src.trim();
      if (!src.startsWith("https://")) continue;

      candidates.push({
        typeRank: typeIndex,
        themeRank: themeRank(logo.theme),
        formatRank: formatIndex,
        src,
      });
    }
  }

  candidates.sort((a, b) => {
    if (a.typeRank !== b.typeRank) return a.typeRank - b.typeRank;
    if (a.themeRank !== b.themeRank) return a.themeRank - b.themeRank;
    return a.formatRank - b.formatRank;
  });

  return candidates[0]?.src ?? null;
}

async function fetchBrandfetchBrand(domain: string): Promise<
  | { ok: true; brand: BrandfetchBrandResponse }
  | { ok: false; reason: BrandfetchUpgradeFailureReason; message?: string }
> {
  const apiKey = getBrandfetchApiKey();
  if (!apiKey) {
    return { ok: false, reason: "brandfetch_api_error", message: "missing_api_key" };
  }

  const response = await fetchWithTimeout(
    `https://api.brandfetch.io/v2/brands/domain/${encodeURIComponent(domain)}`,
    {
      timeoutMs: BRANDFETCH_API_TIMEOUT_MS,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        accept: "application/json",
      },
    },
  );

  if (!response) {
    return { ok: false, reason: "brandfetch_api_error", message: "request_failed" };
  }

  if (response.status === 404) {
    return { ok: false, reason: "brand_not_found" };
  }

  if (!response.ok) {
    return {
      ok: false,
      reason: "brandfetch_api_error",
      message: `http_${response.status}`,
    };
  }

  let brand: BrandfetchBrandResponse;
  try {
    brand = (await response.json()) as BrandfetchBrandResponse;
  } catch {
    return { ok: false, reason: "brandfetch_api_error", message: "invalid_json" };
  }

  return { ok: true, brand };
}

function evaluateSkipReason(company: CompanyUpgradeRow): BrandfetchUpgradeSkipReason | null {
  if (isManualCompanyLogo(company.logo_source)) return "manual";
  if (companyHasBrandfetchLogo(company)) return "already_brandfetch";

  const domainRaw = company.domain?.trim() ?? "";
  if (!domainRaw) return "missing_domain";
  if (!resolveCompanyLogoDomain(domainRaw)) return "invalid_domain";

  return null;
}

async function upgradeSingleCompany(
  company: CompanyUpgradeRow,
): Promise<BrandfetchUpgradeItemResult> {
  const skipReason = evaluateSkipReason(company);
  if (skipReason) {
    return {
      companyId: company.id,
      companyName: company.name,
      status: "skipped",
      reason: skipReason,
    };
  }

  const domain = resolveCompanyLogoDomain(company.domain);
  if (!domain) {
    return {
      companyId: company.id,
      companyName: company.name,
      status: "skipped",
      reason: "invalid_domain",
    };
  }

  const brandResult = await fetchBrandfetchBrand(domain);
  if (!brandResult.ok) {
    return {
      companyId: company.id,
      companyName: company.name,
      status: "failed",
      reason: brandResult.reason,
      message: brandResult.message,
    };
  }

  const assetUrl = pickLogoAssetUrl(brandResult.brand);
  if (!assetUrl) {
    return {
      companyId: company.id,
      companyName: company.name,
      status: "failed",
      reason: "no_logo_asset",
    };
  }

  const image = await downloadImage(assetUrl);
  if (!image) {
    return {
      companyId: company.id,
      companyName: company.name,
      status: "failed",
      reason: "download_failed",
    };
  }

  const upload = await uploadCompanyLogoBytes({
    companyId: company.id,
    bytes: image.bytes,
    contentType: image.contentType,
  });
  if (!upload.ok) {
    return {
      companyId: company.id,
      companyName: company.name,
      status: "failed",
      reason: "upload_failed",
    };
  }

  const supabase = createAdminClient();
  const { error: updateError } = await supabase
    .from("companies")
    .update(logoMetadataPatchForBrandfetchLogoStorage(upload.publicUrl))
    .eq("id", company.id);

  if (updateError) {
    return {
      companyId: company.id,
      companyName: company.name,
      status: "failed",
      reason: "db_update_failed",
      message: updateError.message,
    };
  }

  scheduleCompanyLogoCleanupAfterPersist({
    companyId: company.id,
    publicUrl: upload.publicUrl,
  });

  return {
    companyId: company.id,
    companyName: company.name,
    status: "upgraded",
    logoUrl: upload.publicUrl,
  };
}

export function assertBrandfetchUpgradeBatchSize(companyIds: string[]): void {
  if (companyIds.length === 0) {
    throw new Error("company_ids must not be empty.");
  }
  if (companyIds.length > BRANDFETCH_UPGRADE_MAX_BATCH_SIZE) {
    throw new Error(`At most ${BRANDFETCH_UPGRADE_MAX_BATCH_SIZE} companies per request.`);
  }
}

export async function upgradeCompaniesWithBrandfetchLogo(
  companyIds: string[],
): Promise<BrandfetchUpgradeBatchResult> {
  if (!getBrandfetchApiKey()) {
    throw new Error("BRANDFETCH_API_KEY is not configured.");
  }

  const uniqueIds = [...new Set(companyIds.map((id) => id.trim()).filter((id) => id !== ""))];
  assertBrandfetchUpgradeBatchSize(uniqueIds);

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, domain, logo_url, logo_source, logo_status")
    .in("id", uniqueIds);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as CompanyUpgradeRow[];
  const rowById = new Map(rows.map((row) => [row.id, row]));

  const results: BrandfetchUpgradeItemResult[] = [];

  for (const companyId of uniqueIds) {
    const company = rowById.get(companyId);
    if (!company) {
      results.push({
        companyId,
        companyName: companyId,
        status: "skipped",
        reason: "company_not_found",
      });
      continue;
    }

    results.push(await upgradeSingleCompany(company));
  }

  return {
    results,
    upgraded: results.filter((result) => result.status === "upgraded").length,
    skipped: results.filter((result) => result.status === "skipped").length,
    failed: results.filter((result) => result.status === "failed").length,
  };
}
