import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BackfillResolvedValue,
  BackfillRow,
} from "../core/runBackfillJob";
import { normalizeWebsiteToDomain } from "./domain";

const DEFAULT_LOGO_BUCKET = process.env.BACKFILL_LOGO_BUCKET ?? "company-logos";
const FETCH_TIMEOUT_MS = 5000;
const HTML_FETCH_TIMEOUT_MS = 6000;
const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;

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

export type LogoUploadResolverConfig = {
  supabase: SupabaseClient;
  websiteColumn?: string;
  domainColumn?: string;
  logoColumn?: string;
  bucket?: string;
  storageNamespace: string;
};

function getLogoProviderUrl(domain: string): string {
  const providerBase =
    process.env.LOGO_PROVIDER_BASE_URL ?? "https://logo.clearbit.com";
  return `${providerBase.replace(/\/+$/, "")}/${domain}`;
}

function getGoogleFaviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
}

function extensionFor(contentType: string): string {
  const value = contentType.toLowerCase();
  if (value.includes("png")) return "png";
  if (value.includes("jpeg") || value.includes("jpg")) return "jpg";
  if (value.includes("webp")) return "webp";
  if (value.includes("svg")) return "svg";
  if (value.includes("gif")) return "gif";
  if (value.includes("icon")) return "ico";
  return "bin";
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
  } catch (error) {
    console.warn("[logo-backfill] fetch failed", {
      url,
      reason: error instanceof Error ? error.message : "unknown",
    });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function downloadImage(url: string): Promise<FetchedImage | null> {
  const response = await fetchWithTimeout(url);
  if (!response || !response.ok) return null;

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!isAllowedImageContentType(contentType)) {
    console.warn("[logo-backfill] unsupported content-type", {
      url,
      contentType,
    });
    return null;
  }

  const contentLengthHeader = response.headers.get("content-length");
  if (contentLengthHeader) {
    const length = Number(contentLengthHeader);
    if (Number.isFinite(length) && length > MAX_LOGO_SIZE_BYTES) {
      console.warn("[logo-backfill] content-length too large", { url, length });
      return null;
    }
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_LOGO_SIZE_BYTES) {
    console.warn("[logo-backfill] downloaded bytes invalid", {
      url,
      byteLength: bytes.byteLength,
    });
    return null;
  }

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
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (trimmed.startsWith("/")) return `https://${baseDomain}${trimmed}`;
  return `https://${baseDomain}/${trimmed}`;
}

async function tryProviderLogo(domain: string): Promise<FetchedImage | null> {
  return downloadImage(getLogoProviderUrl(domain));
}

async function tryFaviconLogo(domain: string): Promise<FetchedImage | null> {
  return downloadImage(`https://${domain}/favicon.ico`);
}

async function tryGoogleFaviconLogo(
  domain: string,
): Promise<FetchedImage | null> {
  return downloadImage(getGoogleFaviconUrl(domain));
}

async function tryOgImageLogo(domain: string): Promise<FetchedImage | null> {
  const homepageUrl = `https://${domain}/`;
  const response = await fetchWithTimeout(homepageUrl, {
    timeoutMs: HTML_FETCH_TIMEOUT_MS,
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": "EventPixelsLogoBackfillBot/1.0 (+metadata image fetch)",
    },
  });

  if (!response || !response.ok) return null;
  const html = await response.text();
  const imageUrl = extractOgImageUrl(html, domain);
  return imageUrl ? downloadImage(imageUrl) : null;
}

type LogoStrategy = {
  name: string;
  highQuality: boolean;
  run: (domain: string) => Promise<FetchedImage | null>;
};

const HIGH_QUALITY_STRATEGIES: readonly LogoStrategy[] = [
  { name: "clearbit", highQuality: true, run: tryProviderLogo },
  { name: "og-image", highQuality: true, run: tryOgImageLogo },
];

const LOW_QUALITY_STRATEGIES: readonly LogoStrategy[] = [
  { name: "favicon", highQuality: false, run: tryFaviconLogo },
  { name: "google-favicon", highQuality: false, run: tryGoogleFaviconLogo },
];

function isHighQualityOnlyMode(): boolean {
  const value = process.env.BACKFILL_LOGO_HQ_ONLY;
  return value === "1" || value === "true";
}

function storagePath(input: {
  namespace: string;
  domain: string;
  contentType: string;
}): string {
  return `${input.namespace}/${input.domain}/logo.${extensionFor(input.contentType)}`;
}

async function uploadLogo(input: {
  supabase: SupabaseClient;
  bucket: string;
  namespace: string;
  domain: string;
  image: FetchedImage;
}): Promise<string | null> {
  const path = storagePath({
    namespace: input.namespace,
    domain: input.domain,
    contentType: input.image.contentType,
  });
  const contentType =
    input.image.contentType.split(";")[0]?.trim() || input.image.contentType;

  const { error: uploadError } = await input.supabase.storage
    .from(input.bucket)
    .upload(path, input.image.bytes, {
      upsert: true,
      contentType,
      cacheControl: "3600",
    });

  if (uploadError) {
    console.warn("[logo-backfill] upload failed", {
      bucket: input.bucket,
      domain: input.domain,
      path,
      message: uploadError.message,
    });
    return null;
  }

  const {
    data: { publicUrl },
  } = input.supabase.storage.from(input.bucket).getPublicUrl(path);

  return publicUrl || null;
}

export function createLogoUploadResolver<Row extends BackfillRow>(
  config: LogoUploadResolverConfig,
): (row: Row) => Promise<BackfillResolvedValue | null> {
  const websiteColumn = config.websiteColumn ?? "website_url";
  const domainColumn = config.domainColumn;
  const logoColumn = config.logoColumn ?? "logo_url";
  const bucket = config.bucket ?? DEFAULT_LOGO_BUCKET;

  return async (row: Row): Promise<BackfillResolvedValue | null> => {
    const domain =
      normalizeWebsiteToDomain(row[websiteColumn]) ??
      (domainColumn ? normalizeWebsiteToDomain(row[domainColumn]) : null);
    if (!domain) return null;

    const hqOnly = isHighQualityOnlyMode();
    const strategies: readonly LogoStrategy[] = hqOnly
      ? HIGH_QUALITY_STRATEGIES
      : [...HIGH_QUALITY_STRATEGIES, ...LOW_QUALITY_STRATEGIES];

    for (const strategy of strategies) {
      let image: FetchedImage | null = null;
      try {
        image = await strategy.run(domain);
      } catch (error) {
        console.warn("[logo-backfill] strategy threw", {
          domain,
          strategy: strategy.name,
          reason: error instanceof Error ? error.message : "unknown",
        });
      }

      if (!image) continue;

      const publicUrl = await uploadLogo({
        supabase: config.supabase,
        bucket,
        namespace: config.storageNamespace,
        domain,
        image,
      });
      if (!publicUrl) continue;

      console.info("[logo-backfill] resolved", {
        domain,
        strategy: strategy.name,
        highQuality: strategy.highQuality,
        sourceUrl: image.sourceUrl,
      });

      return {
        column: logoColumn,
        value: publicUrl,
        preview: `${publicUrl} (via ${strategy.name})`,
      };
    }

    return null;
  };
}
