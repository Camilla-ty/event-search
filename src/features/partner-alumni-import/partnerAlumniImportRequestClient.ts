import type { ImportScope } from "./client/types";
import type { ApiErr } from "./client/types";

export function partnerAlumniImportApiBase(scope: ImportScope): string {
  return `/api/admin/event-series/${scope.seriesId}/partner-alumni/versions/${scope.versionId}/import`;
}

export async function postPartnerAlumniImportJson<T>(
  scope: ImportScope,
  path: string,
  body?: unknown,
  init?: RequestInit,
): Promise<T | ApiErr> {
  const res = await fetch(`${partnerAlumniImportApiBase(scope)}${path}`, {
    method: "POST",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    ...init,
  });
  return (await res.json()) as T | ApiErr;
}

export async function patchPartnerAlumniImportJson<T>(
  scope: ImportScope,
  path: string,
  body: unknown,
): Promise<T | ApiErr> {
  const res = await fetch(`${partnerAlumniImportApiBase(scope)}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as T | ApiErr;
}

export async function getPartnerAlumniImportJson<T>(
  scope: ImportScope,
  path: string,
): Promise<T | ApiErr> {
  const res = await fetch(`${partnerAlumniImportApiBase(scope)}${path}`);
  return (await res.json()) as T | ApiErr;
}
