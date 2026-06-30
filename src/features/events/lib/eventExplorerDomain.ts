export type EventExplorerWebsiteHosts = {
  edition: string;
  series: string;
};

export type EventExplorerWebsiteSource = {
  website_url?: string | null;
  event_series?: {
    website_url?: string | null;
  } | null;
};

export type EventExplorerDomainMatchMode = "exact" | "prefix" | "includes";

function normalizeExplorerText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function parseWebsiteUrl(website: string): URL | null {
  const trimmed = website.trim();
  if (trimmed === "") return null;

  try {
    const withProtocol =
      trimmed.startsWith("http://") || trimmed.startsWith("https://")
        ? trimmed
        : `https://${trimmed}`;
    const parsed = new URL(withProtocol);
    if (parsed.hostname === "") return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Canonical hostname for event edition/series website search (no path). */
export function normalizeEventExplorerWebsiteHost(websiteOrDomain: string): string {
  const trimmed = websiteOrDomain.trim();
  if (trimmed === "") return "";

  const parsed = parseWebsiteUrl(trimmed);
  if (parsed) {
    return parsed.hostname.trim().toLowerCase().replace(/^www\./, "");
  }

  const fallback = trimmed
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    ?.split("?")[0]
    ?? "";

  return fallback;
}

export function readEventExplorerWebsiteHosts(
  item: EventExplorerWebsiteSource,
): EventExplorerWebsiteHosts {
  return {
    edition: normalizeEventExplorerWebsiteHost(item.website_url ?? ""),
    series: normalizeEventExplorerWebsiteHost(item.event_series?.website_url ?? ""),
  };
}

function hostMatchesDomainQuery(
  host: string,
  domainQuery: string,
  textQuery: string,
  mode: EventExplorerDomainMatchMode,
): boolean {
  if (host === "") return false;

  if (domainQuery !== "") {
    if (mode === "exact" && host === domainQuery) return true;
    if (mode === "prefix" && host.startsWith(domainQuery)) return true;
    if (mode === "includes" && host.includes(domainQuery)) return true;
  }

  if (textQuery !== "" && mode !== "exact") {
    if (mode === "prefix" && host.startsWith(textQuery)) return true;
    if (mode === "includes" && host.includes(textQuery)) return true;
  }

  return false;
}

export function eventExplorerDomainMatchesQuery(
  source: EventExplorerWebsiteSource,
  query: string,
  mode: EventExplorerDomainMatchMode,
): boolean {
  return eventExplorerDomainMatchesHosts(readEventExplorerWebsiteHosts(source), query, mode);
}

export function eventExplorerDomainMatchesHosts(
  hosts: EventExplorerWebsiteHosts,
  query: string,
  mode: EventExplorerDomainMatchMode,
): boolean {
  const domainQuery = normalizeEventExplorerWebsiteHost(query);
  const textQuery = normalizeExplorerText(query);

  return (
    hostMatchesDomainQuery(hosts.edition, domainQuery, textQuery, mode) ||
    hostMatchesDomainQuery(hosts.series, domainQuery, textQuery, mode)
  );
}
