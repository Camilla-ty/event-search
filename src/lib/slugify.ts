/** URL-safe slug from arbitrary text (shared admin + API). */
export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function slugAlreadyEndsWithYear(slug: string, year: number): boolean {
  const yearStr = String(year);
  return slug === yearStr || slug.endsWith(`-${yearStr}`);
}

/** City or region hint disambiguates multi-city editions in the same year. */
export function buildEditionSlug(
  name: string,
  year: number,
  locationHint?: string | null,
): string {
  const parts = [name.trim()];
  const location = locationHint?.trim() ?? "";
  if (location !== "") {
    parts.push(location);
  }

  const baseSlug = slugify(parts.join(" "));
  if (slugAlreadyEndsWithYear(baseSlug, year)) {
    return baseSlug;
  }

  return slugify(`${parts.join(" ")} ${year}`);
}

/** First segment of a city option label (e.g. "Singapore, Singapore" → "Singapore"). */
export function cityLabelToSlugHint(label: string): string {
  const segment = label.split(",")[0]?.trim() ?? "";
  return segment;
}
