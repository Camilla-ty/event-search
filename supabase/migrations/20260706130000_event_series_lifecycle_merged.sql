-- Revert mistaken edition-level lifecycle columns, then apply series-level merge navigation.

ALTER TABLE public.event_editions
  DROP CONSTRAINT IF EXISTS event_editions_lifecycle_status_check;

ALTER TABLE public.event_editions
  DROP CONSTRAINT IF EXISTS event_editions_merged_into_requires_status;

ALTER TABLE public.event_editions
  DROP CONSTRAINT IF EXISTS event_editions_merged_status_requires_target;

ALTER TABLE public.event_editions
  DROP CONSTRAINT IF EXISTS event_editions_no_self_merge;

DROP INDEX IF EXISTS public.event_editions_merged_into_edition_id_idx;

ALTER TABLE public.event_editions
  DROP COLUMN IF EXISTS lifecycle_status,
  DROP COLUMN IF EXISTS lifecycle_note,
  DROP COLUMN IF EXISTS merged_into_edition_id;

UPDATE public.event_series
SET lifecycle_status = NULL
WHERE lifecycle_status = 'rebranded';

ALTER TABLE public.event_series
  DROP CONSTRAINT IF EXISTS event_series_lifecycle_status_check;

ALTER TABLE public.event_series
  ADD CONSTRAINT event_series_lifecycle_status_check
  CHECK (
    lifecycle_status IS NULL
    OR lifecycle_status IN ('active', 'discontinued', 'merged')
  );

ALTER TABLE public.event_series
  ADD COLUMN IF NOT EXISTS merged_into_series_id uuid
    REFERENCES public.event_series (id) ON DELETE RESTRICT;

UPDATE public.event_series AS source
SET merged_into_series_id = target.id
FROM public.event_series AS target
WHERE source.slug = 'startmeuphk-festival'
  AND source.lifecycle_status = 'merged'
  AND source.merged_into_series_id IS NULL
  AND target.slug = 'hong-kong-fintech-week';

UPDATE public.event_series
SET lifecycle_status = NULL
WHERE lifecycle_status = 'merged'
  AND merged_into_series_id IS NULL;

ALTER TABLE public.event_series
  DROP CONSTRAINT IF EXISTS event_series_merged_into_requires_status;

ALTER TABLE public.event_series
  ADD CONSTRAINT event_series_merged_into_requires_status
  CHECK (
    merged_into_series_id IS NULL
    OR lifecycle_status = 'merged'
  );

ALTER TABLE public.event_series
  DROP CONSTRAINT IF EXISTS event_series_merged_status_requires_target;

ALTER TABLE public.event_series
  ADD CONSTRAINT event_series_merged_status_requires_target
  CHECK (
    lifecycle_status IS DISTINCT FROM 'merged'
    OR merged_into_series_id IS NOT NULL
  );

ALTER TABLE public.event_series
  DROP CONSTRAINT IF EXISTS event_series_no_self_merge;

ALTER TABLE public.event_series
  ADD CONSTRAINT event_series_no_self_merge
  CHECK (
    merged_into_series_id IS NULL
    OR merged_into_series_id <> id
  );

CREATE INDEX IF NOT EXISTS event_series_merged_into_series_id_idx
  ON public.event_series (merged_into_series_id)
  WHERE merged_into_series_id IS NOT NULL;
