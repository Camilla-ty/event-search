import { createAdminClient } from "@/src/lib/supabase/admin";

const LOGO_BUCKET = "company-logos";
const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;
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
};

function normalizeDomain(domain: string): string {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

/** @deprecated Legacy storage backfill only — Clearbit shut down Dec 2025. Prefer Logo.dev metadata flow. */
function getLegacyLogoProviderUrl(domain: string): string {
  const providerBase =
    process.env.LOGO_PROVIDER_BASE_URL ?? "https://logo.clearbit.com";
  return `${providerBase.replace(/\/+$/, "")}/${domain}`;
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
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function downloadImage(url: string): Promise<FetchedImage | null> {
  const response = await fetchWithTimeout(url);
  if (!response || !response.ok) {
    return null;
  }
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!isAllowedImageContentType(contentType)) {
    return null;
  }
  const contentLengthHeader = response.headers.get("content-length");
  if (contentLengthHeader) {
    const length = Number(contentLengthHeader);
    if (Number.isFinite(length) && length > MAX_LOGO_SIZE_BYTES) {
      return null;
    }
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_LOGO_SIZE_BYTES) {
    return null;
  }
  return { bytes, contentType };
}

async function tryProviderLogo(domain: string): Promise<FetchedImage | null> {
  return downloadImage(getLegacyLogoProviderUrl(domain));
}

async function tryFaviconLogo(domain: string): Promise<FetchedImage | null> {
  return downloadImage(`https://${domain}/favicon.ico`);
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
  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }
  if (trimmed.startsWith("/")) {
    return `https://${baseDomain}${trimmed}`;
  }
  return `https://${baseDomain}/${trimmed}`;
}

async function tryOgImageLogo(domain: string): Promise<FetchedImage | null> {
  const response = await fetchWithTimeout(`https://${domain}/`, {
    timeoutMs: HTML_FETCH_TIMEOUT_MS,
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": "EventPixelsLogoBot/1.0 (+server-side fetch)",
    },
  });
  if (!response || !response.ok) {
    return null;
  }
  const html = await response.text();
  const imageUrl = extractOgImageUrl(html, domain);
  if (!imageUrl) {
    return null;
  }
  return downloadImage(imageUrl);
}

async function uploadLogoToBucket(
  domain: string,
  image: FetchedImage,
): Promise<string | null> {
  const supabase = createAdminClient();
  const path = `${domain}/logo.${extensionFor(image.contentType)}`;
  const { error: uploadError } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(path, image.bytes, {
      upsert: true,
      contentType: image.contentType.split(";")[0]?.trim() || image.contentType,
      cacheControl: "3600",
    });

  if (uploadError) {
    return null;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
  return publicUrl || null;
}

export async function resolveExistingLogoUrlByDomain(domain: string) {
  const normalizedDomain = normalizeDomain(domain);
  if (!normalizedDomain) return null;
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("companies")
    .select("logo_url")
    .eq("domain", normalizedDomain)
    .not("logo_url", "is", null)
    .limit(1);

  if (error) {
    return null;
  }

  const logoUrl = data?.[0]?.logo_url;
  return typeof logoUrl === "string" && logoUrl.length > 0 ? logoUrl : null;
}

/**
 * @deprecated Use `ingestCompanyLogoByDomain` from `companyLogoIngest.ts`.
 *
 * Legacy fetch + upload (Clearbit-era provider chain). Not used by live ingest.
 */
export async function fetchAndUploadLogoByDomain(domain: string): Promise<string | null> {
  const normalizedDomain = normalizeDomain(domain);
  if (!normalizedDomain) return null;

  const existingLogoUrl = await resolveExistingLogoUrlByDomain(normalizedDomain);
  if (existingLogoUrl) {
    return existingLogoUrl;
  }

  const strategies: Array<(d: string) => Promise<FetchedImage | null>> = [
    tryProviderLogo,
    tryFaviconLogo,
    tryOgImageLogo,
  ];

  for (const strategy of strategies) {
    let image: FetchedImage | null = null;
    try {
      image = await strategy(normalizedDomain);
    } catch {
      image = null;
    }
    if (!image) continue;

    try {
      const publicUrl = await uploadLogoToBucket(normalizedDomain, image);
      if (publicUrl) return publicUrl;
    } catch {
      // try next strategy
    }
  }

  return null;
}
