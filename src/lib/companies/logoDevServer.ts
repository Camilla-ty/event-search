import {
  isAllowedLogoRasterContentType,
  MAX_LOGO_BINARY_BYTES,
  validateLogoBinary,
} from "@/src/lib/companies/logoBinaryValidation";
import { safeOutboundFetch } from "@/src/lib/security/safeOutboundFetch";

const LOGO_DEV_IMAGE_HOST = "https://img.logo.dev";

const FETCH_TIMEOUT_MS = 5000;

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
  return isAllowedLogoRasterContentType(contentType);
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response | null> {
  const { timeoutMs = FETCH_TIMEOUT_MS, ...rest } = init;
  return safeOutboundFetch(url, {
    timeoutMs,
    init: rest,
  });
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
    if (Number.isFinite(length) && length > MAX_LOGO_BINARY_BYTES) return null;
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  const validation = validateLogoBinary(bytes);
  if (!validation.ok) return null;

  return {
    bytes,
    contentType: validation.contentType,
    sourceUrl: url,
  };
}
