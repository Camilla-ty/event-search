import type { Metadata } from "next";

import { BRAND_LOGO_WORDMARK_SRC, BRAND_NAME } from "@/src/lib/design/brand";

export const SITE_DESCRIPTION =
  "Event industry intelligence platform for discovering, analyzing, and searching events, sponsors, and companies.";

const DEFAULT_OG_IMAGE_PATH = BRAND_LOGO_WORDMARK_SRC;

/** Resolves canonical site URL for metadataBase and absolute OG URLs. */
export function getSiteUrl(): URL {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) {
    return new URL(explicit.endsWith("/") ? explicit : `${explicit}/`);
  }
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    return new URL(`https://${vercel.replace(/^https?:\/\//, "")}/`);
  }
  return new URL("http://localhost:3000/");
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
  const canonicalPath = path ?? "/";
  const url = new URL(canonicalPath.replace(/^\//, ""), siteMetadataBase).toString();

  return {
    title,
    description,
    alternates: path ? { canonical: url } : undefined,
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
