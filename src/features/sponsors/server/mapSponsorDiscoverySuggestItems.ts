import type { SponsorDiscoveryInternalRow } from "@/src/features/sponsors/server/sponsorDiscoveryTypes";
import type { SponsorSuggestItem } from "@/src/features/sponsors/server/sponsorDiscoverySuggestTypes";

export function mapSponsorDiscoverySuggestItems(
  rows: readonly SponsorDiscoveryInternalRow[],
): SponsorSuggestItem[] {
  const items: SponsorSuggestItem[] = [];

  for (const row of rows) {
    const id = row.id.trim();
    const slug = row.slug.trim();
    const name = row.name.trim();
    if (id === "" || slug === "" || name === "") {
      continue;
    }

    items.push({
      id,
      slug,
      name,
      domain: row.domain,
      logo_url: row.logo_url,
    });
  }

  return items;
}
