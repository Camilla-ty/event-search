export function isValidHttpUrl(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "") return false;
  try {
    const withProtocol =
      trimmed.startsWith("http://") || trimmed.startsWith("https://")
        ? trimmed
        : `https://${trimmed}`;
    const parsed = new URL(withProtocol);
    return parsed.hostname.length > 0;
  } catch {
    return false;
  }
}
