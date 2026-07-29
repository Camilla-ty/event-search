import type { PublicBreadcrumbItem } from "@/src/components/common/PublicBreadcrumbs";
import { getSiteUrl } from "@/src/lib/metadata/site";

const SCHEMA_CONTEXT = "https://schema.org";

export type BuildBreadcrumbListJsonLdInput = {
  items: readonly PublicBreadcrumbItem[];
  /** Canonical path for the current page (e.g. `/events/{slug}`). */
  currentPagePath: string;
  /** Override for tests; defaults to `getSiteUrl()`. */
  siteUrl?: URL;
};

export type BreadcrumbListJsonLd = {
  "@context": typeof SCHEMA_CONTEXT;
  "@type": "BreadcrumbList";
  itemListElement: Array<{
    "@type": "ListItem";
    position: number;
    name: string;
    item: string;
  }>;
};

function trimText(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Strip query string and hash; keep path only. */
function stripQueryAndHash(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === "") return "";

  const hashIndex = trimmed.indexOf("#");
  const withoutHash =
    hashIndex >= 0 ? trimmed.slice(0, hashIndex) : trimmed;
  const queryIndex = withoutHash.indexOf("?");
  return queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
}

function absoluteUrlFromHref(href: string, siteUrl: URL): string | null {
  const cleaned = stripQueryAndHash(href);
  if (cleaned === "") return null;

  try {
    if (/^https?:\/\//i.test(cleaned)) {
      const absolute = new URL(cleaned);
      if (absolute.protocol !== "http:" && absolute.protocol !== "https:") {
        return null;
      }
      absolute.search = "";
      absolute.hash = "";
      return absolute.toString();
    }

    const path = cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
    return new URL(path.replace(/^\//, ""), siteUrl).toString();
  } catch {
    return null;
  }
}

/**
 * Builds schema.org BreadcrumbList JSON-LD from the same items rendered by
 * PublicBreadcrumbs. Returns null when the trail is incomplete or weak.
 */
export function buildBreadcrumbListJsonLd(
  input: BuildBreadcrumbListJsonLdInput,
): BreadcrumbListJsonLd | null {
  const items = input.items;
  if (!items || items.length < 2) return null;

  const siteUrl = input.siteUrl ?? getSiteUrl();
  const currentPageUrl = absoluteUrlFromHref(input.currentPagePath, siteUrl);
  if (!currentPageUrl) return null;

  const listItems: BreadcrumbListJsonLd["itemListElement"] = [];

  for (let index = 0; index < items.length; index += 1) {
    const crumb = items[index];
    const name = trimText(crumb?.label);
    if (name === "") return null;

    const isLast = index === items.length - 1;
    let itemUrl: string | null;

    if (isLast) {
      itemUrl = currentPageUrl;
    } else {
      const href = trimText(crumb?.href);
      if (href === "") return null;
      itemUrl = absoluteUrlFromHref(href, siteUrl);
      if (!itemUrl) return null;
    }

    listItems.push({
      "@type": "ListItem",
      position: index + 1,
      name,
      item: itemUrl,
    });
  }

  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: listItems,
  };
}
