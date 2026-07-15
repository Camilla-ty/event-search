import type { Metadata } from "next";

import { BRAND_LOGO_WORDMARK_SRC, BRAND_NAME } from "@/src/lib/design/brand";

export const SITE_DESCRIPTION =
  "Event industry intelligence platform for discovering, analyzing, and searching events, sponsors, and companies.";

/** Stable public origin for canonical / Open Graph / sitemap URLs. */
export const PRODUCTION_SITE_ORIGIN = "https://app.eventpx.com";

const DEFAULT_OG_IMAGE_PATH = BRAND_LOGO_WORDMARK_SRC;

function isVercelDeploymentHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  return host === "vercel.app" || host.endsWith(".vercel.app");
}

/**
 * Resolves the site origin for metadataBase, canonical links, and OG URLs.
 * Never uses VERCEL_URL / *.vercel.app preview hosts — those must not appear in
 * public metadata.
 */
export function getSiteUrl(
  env: NodeJS.ProcessEnv = process.env,
): URL {
  const explicit = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) {
    const candidate = new URL(explicit.endsWith("/") ? explicit : `${explicit}/`);
    if (!isVercelDeploymentHostname(candidate.hostname)) {
      return candidate;
    }
  }

  const isLocalDev =
    env.NODE_ENV === "development" &&
    env.VERCEL !== "1" &&
    env.VERCEL_ENV !== "preview" &&
    env.VERCEL_ENV !== "production";

  if (isLocalDev) {
    return new URL("http://localhost:3000/");
  }

  return new URL(`${PRODUCTION_SITE_ORIGIN}/`);
}

export const siteMetadataBase = getSiteUrl();

const defaultOpenGraphImages: NonNullable<Metadata["openGraph"]>["images"] = [
  {
    url: DEFAULT_OG_IMAGE_PATH,
    alt: BRAND_NAME,
  },
];

/** Root layout defaults — title.template applies to child segment titles. */
export const rootSiteMetadata: Metadata = {
  metadataBase: siteMetadataBase,
  title: {
    default: BRAND_NAME,
    template: `%s | ${BRAND_NAME}`,
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: BRAND_NAME,
    title: BRAND_NAME,
    description: SITE_DESCRIPTION,
    images: defaultOpenGraphImages,
  },
  twitter: {
    card: "summary_large_image",
    title: BRAND_NAME,
    description: SITE_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE_PATH],
  },
};

type PageMetadataInput = {
  title: string;
  description?: string;
  path?: string;
};

/** Per-route metadata with consistent OG/Twitter and title segment for template. */
export function createPageMetadata({
  title,
  description = SITE_DESCRIPTION,
  path,
}: PageMetadataInput): Metadata {
  const metadataBase = getSiteUrl();
  const canonicalPath = path ?? "/";
  const url = new URL(canonicalPath.replace(/^\//, ""), metadataBase).toString();

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      images: defaultOpenGraphImages,
    },
    twitter: {
      title,
      description,
      images: [DEFAULT_OG_IMAGE_PATH],
    },
  };
}
