import type { MetadataRoute } from "next";

import { PRODUCTION_SITE_ORIGIN } from "@/src/lib/metadata/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${PRODUCTION_SITE_ORIGIN}/sitemap.xml`,
  };
}
