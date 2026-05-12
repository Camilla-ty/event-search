export function normalizeWebsiteToDomain(websiteUrl: unknown): string | null {
  if (typeof websiteUrl !== "string") return null;
  const value = websiteUrl.trim();
  if (!value) return null;

  try {
    const withProtocol =
      value.startsWith("http://") || value.startsWith("https://")
        ? value
        : `https://${value}`;
    const parsed = new URL(withProtocol);
    const hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();
    return hostname.length > 0 ? hostname : null;
  } catch {
    return null;
  }
}
