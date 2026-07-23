import { normalizeDomainFromWebsite } from "./normalizeDomain";

export type PublicCompanyWebsiteInput = {
  website?: string | null;
  domain?: string | null;
};

export type PublicCompanyWebsiteDisplay = {
  href: string;
  label: string;
};

function parseAbsoluteHref(website: string): string | null {
  const trimmed = website.trim();
  if (trimmed === "") return null;

  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withProtocol);
    if (parsed.hostname === "") return null;
    return parsed.href;
  } catch {
    return null;
  }
}

/**
 * Public sponsor profile website link: clean canonical label + valid absolute href.
 * Label prefers `domain`; href prefers full `website`, then https://{domain}.
 */
export function formatPublicCompanyWebsite(
  input: PublicCompanyWebsiteInput,
): PublicCompanyWebsiteDisplay | null {
  const website = input.website?.trim() ?? "";
  const domain = input.domain?.trim().toLowerCase() ?? "";

  let href: string | null = null;
  if (website !== "") {
    href = parseAbsoluteHref(website);
  }
  if (href === null && domain !== "") {
    href = `https://${domain}`;
  }
  if (href === null) return null;

  let label =
    domain !== "" ? domain : normalizeDomainFromWebsite(website !== "" ? website : href);

  // no_identity websites (e.g. Facebook) yield an empty identity key — still show
  // a host label so the preserved companies.website remains publicly linkable.
  if (label === "") {
    try {
      const parsed = new URL(href);
      const host = parsed.hostname.trim().toLowerCase().replace(/^www\./, "");
      label = host;
    } catch {
      return null;
    }
  }
  if (label === "") return null;

  return { href, label };
}
