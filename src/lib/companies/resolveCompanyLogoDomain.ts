export function resolveCompanyLogoDomain(domain: string | null | undefined): string | null {
  const trimmed = domain?.trim().toLowerCase() ?? "";
  if (!trimmed) return null;
  if (!/^[a-z0-9][a-z0-9.-]*(\/[a-z0-9._-]*)*$/i.test(trimmed)) return null;
  return trimmed;
}
