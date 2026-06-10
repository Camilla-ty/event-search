const LOGO_DEV_IMAGE_HOST = "https://img.logo.dev";

const FETCH_TIMEOUT_MS = 5000;
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

export type LogoDevFetchedImage = {
  bytes: Uint8Array;
  contentType: string;
  sourceUrl: string;
};

export function getLogoDevServerPublishableKey(): string | null {
  const key = process.env.LOGO_DEV_PUBLISHABLE_KEY?.trim();
  return key && key.length > 0 ? key : null;
}

export function buildLogoDevFetchUrl(
  domain: string,
  options?: { size?: number; format?: "jpg" | "png" | "webp" },
): string | null {
  const normalizedDomain = domain.trim().toLowerCase();
  if (!normalizedDomain) return null;

  const token = getLogoDevServerPublishableKey();
  if (!token) return null;

  const size = options?.size ?? 128;
  const format = options?.format ?? "webp";

  const params = new URLSearchParams({
    token,
    fallback: "404",
    size: String(size),
    format,
  });

  return `${LOGO_DEV_IMAGE_HOST}/${encodeURIComponent(normalizedDomain)}?${params.toString()}`;
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

/**
 * Download a logo image from Logo.dev (server-only key). Returns null on 404 or failure.
 */
export async function fetchLogoDevImage(
  domain: string,
): Promise<LogoDevFetchedImage | null> {
  const url = buildLogoDevFetchUrl(domain);
  if (!url) return null;

  const response = await fetchWithTimeout(url);
  if (!response) return null;
  if (response.status === 404) return null;
  if (!response.ok) return null;

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
