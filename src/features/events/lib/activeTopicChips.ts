import { buildTopicHubPath } from "@/src/lib/routes/explorerUrls";

export type ActiveTopicChip = {
  slug: string;
  label: string;
  unknown: boolean;
  hubPath: string | null;
};

export function buildActiveTopicChips(
  selectedSlugs: readonly string[],
  topicOptions: readonly { slug: string; name: string }[],
): ActiveTopicChip[] {
  const nameBySlug = new Map(topicOptions.map((topic) => [topic.slug, topic.name]));
  const seen = new Set<string>();
  const chips: ActiveTopicChip[] = [];

  for (const slug of selectedSlugs) {
    if (seen.has(slug)) continue;
    seen.add(slug);

    const name = nameBySlug.get(slug);
    if (name !== undefined) {
      chips.push({
        slug,
        label: name,
        unknown: false,
        hubPath: buildTopicHubPath(slug),
      });
      continue;
    }

    chips.push({
      slug,
      label: `${slug} (not found)`,
      unknown: true,
      hubPath: null,
    });
  }

  return chips;
}
