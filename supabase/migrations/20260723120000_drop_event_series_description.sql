-- Drop unused event_series.description after app stopped reading/writing it.
-- Archival CSV: docs/audits/event-series-description-archive-2026-07-18.csv (gitignored).
-- Public copy + SEO now use the factual summary engine (buildEventSeriesSummary /
-- buildSeriesMetadataDescription). No DB function/view/trigger depended on this column.

ALTER TABLE public.event_series
  DROP COLUMN IF EXISTS description;
