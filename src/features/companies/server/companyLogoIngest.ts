import {
  fetchLogoDevImage,
  getLogoDevServerPublishableKey,
} from "@/src/lib/companies/logoDevServer";
import { createAdminClient } from "@/src/lib/supabase/admin";

import {
  COMPANY_LOGO_BUCKET,
  COMPANY_LOGO_STORAGE_NAMESPACE,
  extensionForContentType,
  MAX_COMPANY_LOGO_SIZE_BYTES,
  uploadCompanyLogoBytes,
} from "./companyLogoStorage";
import type { CompanyLogoIngestResult } from "./companyLogoMetadata";

const FETCH_TIMEOUT_MS = 5000;
const HTML_FETCH_TIMEOUT_MS = 6000;

const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/svg+xml",
  "image/gif",
  "image/x-icon",
  "image/vnd.microsoft.icon",
];

type FetchedImage = {
  bytes: Uint8Array;
  contentType: string;
  sourceUrl: string;
};

type LogoStrategy = {
  name: string;
  run: (domain: string) => Promise<FetchedImage | null>;
};

export type CompanyLogoIngestOptions = {
  dryRun?: boolean;
  /** Required for company logo uploads (default companies namespace). */
  companyId?: string;
  /** Non-company namespaces (e.g. event-series). Out of scope for companyId migration. */
  storageNamespace?: string;
};

function normalizeDomain(domain: string): string {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

function isAllowedImageContentType(contentType: string): boolean {
  const base = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  return ALLOWED_IMAGE_TYPES.includes(base);
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response | null> {
  const { timeoutMs = FETCH_TIMEOUT_MS, ...rest } = init;
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
    if (Number.isFinite(length) && length > MAX_COMPANY_LOGO_SIZE_BYTES) return null;
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_COMPANY_LOGO_SIZE_BYTES) return null;

  return { bytes, contentType, sourceUrl: url };
}

function extractOgImageUrl(html: string, baseDomain: string): string | null {
  const ogMatch = html.match(
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
  );
  const twitterMatch = !ogMatch
    ? html.match(
        /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
      )
    : null;
  const raw = ogMatch?.[1] ?? twitterMatch?.[1] ?? null;
  if (!raw) return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (trimmed.startsWith("/")) return `https://${baseDomain}${trimmed}`;
  return `https://${baseDomain}/${trimmed}`;
}

function getGoogleFaviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
}

function isHighQualityOnlyMode(): boolean {
  const value = process.env.BACKFILL_LOGO_HQ_ONLY;
  return value === "1" || value === "true";
}

async function tryLogoDevLogo(domain: string): Promise<FetchedImage | null> {
  const image = await fetchLogoDevImage(domain);
  if (!image) return null;
  return {
    bytes: image.bytes,
    contentType: image.contentType,
    sourceUrl: image.sourceUrl,
  };
}

async function tryBrandfetchLogo(domain: string): Promise<FetchedImage | null> {
  const clientId = process.env.BRANDFETCH_CLIENT_ID?.trim();
  if (!clientId) return null;
  const url = `https://cdn.brandfetch.io/${encodeURIComponent(domain)}?c=${encodeURIComponent(clientId)}`;
  return downloadImage(url);
}

async function tryFaviconLogo(domain: string): Promise<FetchedImage | null> {
  return downloadImage(`https://${domain}/favicon.ico`);
}

async function tryGoogleFaviconLogo(domain: string): Promise<FetchedImage | null> {
  return downloadImage(getGoogleFaviconUrl(domain));
}

async function tryOgImageLogo(domain: string): Promise<FetchedImage | null> {
  const response = await fetchWithTimeout(`https://${domain}/`, {
    timeoutMs: HTML_FETCH_TIMEOUT_MS,
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": "EventPixelsCompanyLogoBot/1.0 (+server-side fetch)",
    },
  });
  if (!response || !response.ok) return null;
  const html = await response.text();
  const imageUrl = extractOgImageUrl(html, domain);
  return imageUrl ? downloadImage(imageUrl) : null;
}

const HIGH_QUALITY_STRATEGIES: readonly LogoStrategy[] = [
  { name: "logo_dev", run: tryLogoDevLogo },
  { name: "brandfetch", run: tryBrandfetchLogo },
  { name: "og-image", run: tryOgImageLogo },
];

const LOW_QUALITY_STRATEGIES: readonly LogoStrategy[] = [
  { name: "favicon", run: tryFaviconLogo },
  { name: "google-favicon", run: tryGoogleFaviconLogo },
];

function entityLogoStoragePath(
  identityKey: string,
  contentType: string,
  storageNamespace: string,
): string {
  return `${storageNamespace}/${identityKey}/logo.${extensionForContentType(contentType)}`;
}

async function uploadEntityLogo(
  identityKey: string,
  image: FetchedImage,
  storageNamespace: string,
): Promise<string | null> {
  const supabase = createAdminClient();
  const path = entityLogoStoragePath(identityKey, image.contentType, storageNamespace);
  const contentType =
    image.contentType.split(";")[0]?.trim() || image.contentType;

  const { error: uploadError } = await supabase.storage
    .from(COMPANY_LOGO_BUCKET)
    .upload(path, image.bytes, {
      upsert: true,
      contentType,
      cacheControl: "3600",
    });

  if (uploadError) return null;

  const {
    data: { publicUrl },
  } = supabase.storage.from(COMPANY_LOGO_BUCKET).getPublicUrl(path);

  return publicUrl || null;
}

function strategiesForDomain(): readonly LogoStrategy[] {
  const hqOnly = isHighQualityOnlyMode();
  return hqOnly
    ? HIGH_QUALITY_STRATEGIES
    : [...HIGH_QUALITY_STRATEGIES, ...LOW_QUALITY_STRATEGIES];
}

function isCompanyLogoNamespace(storageNamespace: string): boolean {
  return storageNamespace === COMPANY_LOGO_STORAGE_NAMESPACE;
}

/**
 * Fetch a company logo once, upload to Supabase Storage, return the public URL.
 * Does not write to the database — callers apply `companyLogoMetadataPatch`.
 */
export async function ingestCompanyLogoByDomain(
  domain: string,
  options?: CompanyLogoIngestOptions,
): Promise<CompanyLogoIngestResult> {
  const storageNamespace = options?.storageNamespace?.trim() || COMPANY_LOGO_STORAGE_NAMESPACE;
  const isCompanyNamespace = isCompanyLogoNamespace(storageNamespace);
  const companyId = options?.companyId?.trim() ?? "";

  const identityKey = domain.trim().toLowerCase();
  if (!identityKey) {
    return {
      status: "skipped",
      logoUrl: null,
      strategy: null,
      error: null,
      preview: null,
    };
  }

  if (isCompanyNamespace && !companyId) {
    return {
      status: "error",
      logoUrl: null,
      strategy: null,
      error: "missing_company_id",
      preview: null,
    };
  }

  const fetchHost = normalizeDomain(domain);
  if (!fetchHost) {
    return {
      status: "skipped",
      logoUrl: null,
      strategy: null,
      error: null,
      preview: null,
    };
  }

  if (!getLogoDevServerPublishableKey()) {
    // Logo.dev is first strategy; still attempt fallbacks without key.
  }

  const strategies = strategiesForDomain();
  let lastError: string | null = null;

  for (const strategy of strategies) {
    let image: FetchedImage | null = null;
    try {
      image = await strategy.run(fetchHost);
    } catch {
      image = null;
      lastError = "strategy_threw";
    }

    if (!image) continue;

    if (options?.dryRun) {
      const ext = extensionForContentType(image.contentType);
      const previewPath = isCompanyNamespace
        ? `${COMPANY_LOGO_STORAGE_NAMESPACE}/${companyId}/logo.${ext}`
        : `${storageNamespace}/${identityKey}/logo.${ext}`;
      return {
        status: "ok",
        logoUrl: null,
        strategy: strategy.name,
        error: null,
        preview: `dry-run: would upload ${COMPANY_LOGO_BUCKET}/${previewPath} (via ${strategy.name})`,
      };
    }

    let publicUrl: string | null = null;
    if (isCompanyNamespace) {
      const upload = await uploadCompanyLogoBytes({
        companyId,
        bytes: image.bytes,
        contentType: image.contentType,
      });
      if (!upload.ok) {
        lastError = upload.error;
        continue;
      }
      publicUrl = upload.publicUrl;
    } else {
      publicUrl = await uploadEntityLogo(identityKey, image, storageNamespace);
      if (!publicUrl) {
        lastError = "upload_failed";
        continue;
      }
    }

    return {
      status: "ok",
      logoUrl: publicUrl,
      strategy: strategy.name,
      error: null,
      preview: `${publicUrl} (via ${strategy.name})`,
    };
  }

  if (!getLogoDevServerPublishableKey() && !lastError) {
    lastError = "missing_publishable_key";
  }

  return {
    status: lastError ? "error" : "missing",
    logoUrl: null,
    strategy: null,
    error: lastError,
    preview: null,
  };
}

export type ManualCompanyLogoIngestResult =
  | { ok: true; storageUrl: string; storagePath: string }
  | { ok: false; error: string };

/**
 * Download an admin-provided logo URL and upload it to company Storage.
 * Does not write to the database.
 */
export async function ingestManualCompanyLogoFromUrl(
  externalUrl: string,
  companyId: string,
): Promise<ManualCompanyLogoIngestResult> {
  const trimmedUrl = externalUrl.trim();
  const trimmedCompanyId = companyId.trim();
  if (!trimmedUrl) {
    return { ok: false, error: "empty_url" };
  }
  if (!trimmedCompanyId) {
    return { ok: false, error: "missing_company_id" };
  }

  const image = await downloadImage(trimmedUrl);
  if (!image) {
    return { ok: false, error: "download_failed" };
  }

  const upload = await uploadCompanyLogoBytes({
    companyId: trimmedCompanyId,
    bytes: image.bytes,
    contentType: image.contentType,
  });

  if (!upload.ok) {
    return { ok: false, error: upload.error };
  }

  return { ok: true, storageUrl: upload.publicUrl, storagePath: upload.storagePath };
}

/**
 * Download a pasted logo URL for non-company entities (event series/editions).
 * Does not write to the database.
 */
export async function ingestManualEntityLogoFromUrl(
  externalUrl: string,
  entityId: string,
  storageNamespace: string,
): Promise<ManualCompanyLogoIngestResult> {
  const trimmedUrl = externalUrl.trim();
  const trimmedEntityId = entityId.trim();
  const trimmedNamespace = storageNamespace.trim();
  if (!trimmedUrl) {
    return { ok: false, error: "empty_url" };
  }
  if (!trimmedEntityId || !trimmedNamespace) {
    return { ok: false, error: "missing_storage_key" };
  }

  const image = await downloadImage(trimmedUrl);
  if (!image) {
    return { ok: false, error: "download_failed" };
  }

  const publicUrl = await uploadEntityLogo(trimmedEntityId, image, trimmedNamespace);
  if (!publicUrl) {
    return { ok: false, error: "upload_failed" };
  }

  return {
    ok: true,
    storageUrl: publicUrl,
    storagePath: entityLogoStoragePath(trimmedEntityId, image.contentType, trimmedNamespace),
  };
}
