import {
  fetchLogoDevImage,
  getLogoDevServerPublishableKey,
} from "@/src/lib/companies/logoDevServer";
import { isHostedPlatformIdentityKey } from "@/src/lib/domain/hostedPlatformWebsite";

import {
  EVENT_LOGO_AUTO_ENRICH_REJECTED_ERROR,
  isEventLogoStorageNamespace,
} from "@/src/lib/events/eventLogoPolicy";

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
  /** Required for company logo uploads. */
  companyId?: string;
  /**
   * @deprecated Event logos are manual-only. Non-company namespaces are rejected.
   * Kept only so callers fail fast with a policy error instead of silently ingesting.
   */
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
  { name: "og-image", run: tryOgImageLogo },
];

const LOW_QUALITY_STRATEGIES: readonly LogoStrategy[] = [
  { name: "favicon", run: tryFaviconLogo },
  { name: "google-favicon", run: tryGoogleFaviconLogo },
];

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
 * Company auto-enrich only — event logos are manual-only.
 * Does not write to the database — callers apply `companyLogoMetadataPatch`.
 */
export async function ingestCompanyLogoByDomain(
  domain: string,
  options?: CompanyLogoIngestOptions,
): Promise<CompanyLogoIngestResult> {
  const storageNamespace = options?.storageNamespace?.trim() || COMPANY_LOGO_STORAGE_NAMESPACE;
  const companyId = options?.companyId?.trim() ?? "";

  if (
    !isCompanyLogoNamespace(storageNamespace) ||
    isEventLogoStorageNamespace(storageNamespace)
  ) {
    return {
      status: "error",
      logoUrl: null,
      strategy: null,
      error: EVENT_LOGO_AUTO_ENRICH_REJECTED_ERROR,
      preview: null,
    };
  }

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

  if (isHostedPlatformIdentityKey(identityKey)) {
    return {
      status: "skipped",
      logoUrl: null,
      strategy: null,
      error: null,
      preview: null,
    };
  }

  if (!companyId) {
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
      const previewPath = `${COMPANY_LOGO_STORAGE_NAMESPACE}/${companyId}/logo.${ext}`;
      return {
        status: "ok",
        logoUrl: null,
        strategy: strategy.name,
        error: null,
        preview: `dry-run: would upload ${COMPANY_LOGO_BUCKET}/${previewPath} (via ${strategy.name})`,
      };
    }

    const upload = await uploadCompanyLogoBytes({
      companyId,
      bytes: image.bytes,
      contentType: image.contentType,
    });
    if (!upload.ok) {
      lastError = upload.error;
      continue;
    }

    return {
      status: "ok",
      logoUrl: upload.publicUrl,
      strategy: strategy.name,
      error: null,
      preview: `${upload.publicUrl} (via ${strategy.name})`,
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
