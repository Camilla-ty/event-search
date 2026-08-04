import {
  assertSafeOutboundHttpUrl,
  type AssertSafeOutboundHttpUrlOptions,
  type SafeOutboundLookupFn,
} from "./safeOutboundUrl";

const DEFAULT_MAX_REDIRECTS = 5;

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export type SafeOutboundFetchFn = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export type SafeOutboundFetchOptions = {
  timeoutMs?: number;
  maxRedirects?: number;
  lookupFn?: SafeOutboundLookupFn;
  /** Injected for tests; defaults to global fetch. */
  fetchFn?: SafeOutboundFetchFn;
  /**
   * Extra RequestInit fields (method/headers/body/signal).
   * `redirect` and `cache` are controlled by this helper.
   */
  init?: RequestInit;
};

function isRedirectStatus(status: number): boolean {
  return REDIRECT_STATUSES.has(status);
}

function resolveRedirectUrl(currentUrl: string, locationHeader: string | null): string | null {
  const location = locationHeader?.trim();
  if (!location) return null;
  try {
    return new URL(location, currentUrl).toString();
  } catch {
    return null;
  }
}

/**
 * Outbound http(s) fetch that validates the initial URL and every redirect hop
 * with {@link assertSafeOutboundHttpUrl} (SEC-003 Phase 2).
 *
 * Returns null when the destination is blocked, redirect chain is unsafe/invalid,
 * or the request fails/times out.
 */
export async function safeOutboundFetch(
  url: string,
  options?: SafeOutboundFetchOptions,
): Promise<Response | null> {
  const maxRedirects = options?.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const fetchFn = options?.fetchFn ?? fetch;
  const urlOptions: AssertSafeOutboundHttpUrlOptions | undefined = options?.lookupFn
    ? { lookupFn: options.lookupFn }
    : undefined;

  let currentUrl = url;
  const visited = new Set<string>();

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const safe = await assertSafeOutboundHttpUrl(currentUrl, urlOptions);
    if (!safe.ok) return null;

    if (visited.has(safe.normalized)) return null;
    visited.add(safe.normalized);

    const controller = new AbortController();
    const timeoutMs = options?.timeoutMs;
    const timer =
      typeof timeoutMs === "number" && timeoutMs > 0
        ? setTimeout(() => controller.abort(), timeoutMs)
        : null;

    const outerSignal = options?.init?.signal ?? undefined;
    const onOuterAbort = () => controller.abort();
    if (outerSignal) {
      if (outerSignal.aborted) {
        if (timer) clearTimeout(timer);
        return null;
      }
      outerSignal.addEventListener("abort", onOuterAbort, { once: true });
    }

    let response: Response;
    try {
      const { redirect: _redirect, cache: _cache, signal: _signal, ...restInit } =
        options?.init ?? {};
      void _redirect;
      void _cache;
      void _signal;
      response = await fetchFn(safe.normalized, {
        ...restInit,
        redirect: "manual",
        cache: "no-store",
        signal: controller.signal,
      });
    } catch {
      return null;
    } finally {
      if (timer) clearTimeout(timer);
      if (outerSignal) outerSignal.removeEventListener("abort", onOuterAbort);
    }

    if (!isRedirectStatus(response.status)) {
      return response;
    }

    if (hop === maxRedirects) return null;

    const nextUrl = resolveRedirectUrl(
      safe.normalized,
      response.headers.get("location"),
    );
    if (!nextUrl) return null;

    // Drain/cancel body so undici/fetch can reuse connections cleanly.
    try {
      await response.arrayBuffer();
    } catch {
      // ignore
    }

    currentUrl = nextUrl;
  }

  return null;
}
