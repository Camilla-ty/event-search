import type { EventExplorerTopicFacet } from "@/src/features/events/lib/eventExplorerFilterFacets";

export function buildTopicCheckboxOptions(
  topicOptions: EventExplorerTopicFacet[],
  selectedTopics: readonly string[],
): EventExplorerTopicFacet[] {
  const knownSlugs = new Set(topicOptions.map((topic) => topic.slug));
  const unknownSelected: EventExplorerTopicFacet[] = [];

  for (const slug of selectedTopics) {
    if (knownSlugs.has(slug)) continue;
    unknownSelected.push({ slug, name: `${slug} (not found)` });
  }

  return [...unknownSelected, ...topicOptions];
}

export function toggleTopicSelection(
  selectedTopics: readonly string[],
  slug: string,
  checked: boolean,
): string[] {
  if (checked) {
    return selectedTopics.includes(slug) ? [...selectedTopics] : [...selectedTopics, slug];
  }

  return selectedTopics.filter((topic) => topic !== slug);
}
