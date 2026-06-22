export function buildSponsorSearchUrl(query?: string): string {
  const url = new URL("/sponsors", "http://local");
  const trimmed = query?.trim() ?? "";
  if (trimmed !== "") {
    url.searchParams.set("q", trimmed);
  }
  return `${url.pathname}${url.search}`;
}

export type EventExplorerView = "list" | "calendar";

export function parseEventExplorerView(
  raw: string | null | undefined,
): EventExplorerView {
  const trimmed = (raw ?? "").trim().toLowerCase();
  if (trimmed === "calendar") return "calendar";
  return "list";
}

export function parseEventExplorerMonth(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(trimmed)) return null;

  const month = Number(trimmed.slice(5, 7));
  if (month < 1 || month > 12) return null;

  return trimmed;
}

export function buildEventExplorerUrl(query?: string): string {
  const url = new URL("/events", "http://local");
  const trimmed = query?.trim() ?? "";
  if (trimmed !== "") {
    url.searchParams.set("q", trimmed);
  }
  return `${url.pathname}${url.search}`;
}

export function buildEventExplorerUpcomingUrl(fromDate?: string): string {
  const url = new URL("/events", "http://local");
  const date = fromDate?.trim() || new Date().toISOString().slice(0, 10);
  url.searchParams.set("start", date);
  return `${url.pathname}${url.search}`;
}

export function buildEventExplorerCalendarUrl(month?: string): string {
  const url = new URL("/events", "http://local");
  url.searchParams.set("view", "calendar");
  const normalizedMonth =
    parseEventExplorerMonth(month) ?? new Date().toISOString().slice(0, 7);
  url.searchParams.set("month", normalizedMonth);
  return `${url.pathname}${url.search}`;
}

export function buildTopicHubPath(slug: string): string | null {
  const trimmed = slug.trim();
  if (trimmed === "") return null;
  return `/topics/${encodeURIComponent(trimmed)}`;
}

export function buildEventExplorerTopicUrl(slug: string): string {
  const url = new URL("/events", "http://local");
  const trimmed = slug.trim();
  if (trimmed !== "") {
    url.searchParams.set("topic", trimmed);
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

export function buildSeriesHubPath(series: {
  slug?: string | null;
  id?: string | null;
}): string | null {
  const slug = series.slug?.trim() ?? "";
  const id = series.id?.trim() ?? "";
  const segment = slug !== "" ? slug : id;
  return segment !== "" ? `/events/series/${encodeURIComponent(segment)}` : null;
}
