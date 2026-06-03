export function buildSponsorSearchUrl(query?: string): string {
  const url = new URL("/sponsors", "http://local");
  const trimmed = query?.trim() ?? "";
  if (trimmed !== "") {
    url.searchParams.set("q", trimmed);
  }
  return `${url.pathname}${url.search}`;
}

export function buildEventExplorerUrl(query?: string): string {
  const url = new URL("/events", "http://local");
  const trimmed = query?.trim() ?? "";
  if (trimmed !== "") {
    url.searchParams.set("q", trimmed);
  }
  return `${url.pathname}${url.search}`;
}

export function buildSponsorProfilePath(company: {
  slug?: string | null;
  id?: string | null;
}): string | null {
  const slug = company.slug?.trim() ?? "";
  const id = company.id?.trim() ?? "";
  const segment = slug !== "" ? slug : id;
  return segment !== "" ? `/sponsors/${encodeURIComponent(segment)}` : null;
}

export function buildEventDetailPath(event: {
  slug?: string | null;
  id?: string | null;
}): string | null {
  const slug = event.slug?.trim() ?? "";
  const id = event.id?.trim() ?? "";
  const segment = slug !== "" ? slug : id;
  return segment !== "" ? `/events/${encodeURIComponent(segment)}` : null;
}
