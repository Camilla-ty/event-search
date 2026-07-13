import type { EventFilters } from "@/src/features/events/components/explorer/types";
import type { EventExplorerFilterFacets } from "@/src/features/events/lib/eventExplorerFilterFacets";
import type { EventExplorerSortMode } from "@/src/features/events/lib/eventExplorerOrdering";

import type { EventExplorerActiveTopic } from "@/src/features/events/server/getEventExplorerData";
import type { EventExplorerParams } from "@/src/features/events/server/eventExplorerParams";

export type EventExplorerRow = {
  id: string;
  slug: string;
  name: string;
  href: string;
  start_date: string | null;
  end_date: string | null;
  sponsor_count: number;
  location_label: string;
  series: {
    name: string | null;
    logo_url: string | null;
  } | null;
  keyword_preview: {
    visible: string[];
    overflow_count: number;
  } | null;
};

export type EventExplorerPageResult = {
  rows: EventExplorerRow[];
  total: number;
  page: number;
  page_size: number;
  sort: EventExplorerSortMode;
  filters: EventFilters;
  facets: EventExplorerFilterFacets;
  activeTopic: EventExplorerActiveTopic | null;
  topicUnknown: boolean;
  params: EventExplorerParams;
  pageWasClamped?: boolean;
};
