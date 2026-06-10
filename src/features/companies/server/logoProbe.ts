import { buildLogoDevImageUrl } from "@/src/lib/companies/logoDev";
import type { LogoStatus } from "@/src/lib/companies/logoTypes";

const PROBE_TIMEOUT_MS = 5000;

export type LogoDevProbeResult = {
  status: LogoStatus;
  error: string | null;
};

function normalizeDomain(domain: string): string {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response | null> {
  const { timeoutMs = PROBE_TIMEOUT_MS, ...rest } = init;
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
 * Probe Logo.dev for a domain logo without downloading or storing the image.
 * Updates logo metadata only (`logo_status`, `logo_fetched_at`, `logo_fetch_error`).
 */
export async function probeLogoDevByDomain(domain: string): Promise<LogoDevProbeResult> {
  const normalizedDomain = normalizeDomain(domain);
  if (!normalizedDomain) {
    return { status: "skipped", error: null };
  }

  const logoDevUrl = buildLogoDevImageUrl(normalizedDomain, { size: 64 });
  if (!logoDevUrl) {
    return { status: "error", error: "missing_publishable_key" };
  }

  let response = await fetchWithTimeout(logoDevUrl, { method: "HEAD" });
  if (!response) {
    response = await fetchWithTimeout(logoDevUrl, { method: "GET" });
  }

  if (!response) {
    return { status: "error", error: "network_error" };
  }

  if (response.status === 404) {
    return { status: "missing", error: null };
  }

  if (!response.ok) {
    return { status: "error", error: `http_${response.status}` };
  }

  return { status: "ok", error: null };
}
