import type { ApiErr } from "./client/types";

type PostSponsorImportJsonOptions = {
  timeoutMs: number;
  retryMessage: string;
  body?: Record<string, unknown>;
};

function timeoutSeconds(timeoutMs: number): number {
  return Math.round(timeoutMs / 1000);
}

export async function postSponsorImportJson<T extends { ok: true }>(
  url: string,
  options: PostSponsorImportJsonOptions,
): Promise<T | ApiErr> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: options.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    let data: T | ApiErr;
    try {
      data = (await res.json()) as T | ApiErr;
    } catch {
      return {
        ok: false,
        error: res.ok
          ? options.retryMessage
          : `Request failed (HTTP ${res.status}). ${options.retryMessage}`,
      };
    }

    if (!data.ok) {
      return data;
    }

    if (!res.ok) {
      return { ok: false, error: options.retryMessage };
    }

    return data;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return {
        ok: false,
        error: `Timed out after ${timeoutSeconds(options.timeoutMs)} seconds. ${options.retryMessage}`,
      };
    }

    return {
      ok: false,
      error: `Network error. ${options.retryMessage}`,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
