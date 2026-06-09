/** Normalize a website URL or hostname to a canonical domain (no www, no path). */
export function normalizeDomainFromWebsite(website: string): string {
  const value = website.trim().toLowerCase();
  if (!value) return "";

  try {
    const withProtocol =
      value.startsWith("http://") || value.startsWith("https://")
        ? value
        : `https://${value}`;
    const parsed = new URL(withProtocol);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return value
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/.*$/, "");
  }
}

/** Alias used by sponsor import modules. */
export function normalizeDomain(websiteOrDomain: string): string {
  return normalizeDomainFromWebsite(websiteOrDomain);
}
