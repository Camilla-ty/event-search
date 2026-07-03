-- Edition lifecycle + merged-into navigation (Phase 1).
-- Superseded by 20260706130000_event_series_lifecycle_merged.sql (reverted on remote).

ALTER TABLE public.event_editions
  ADD COLUMN IF NOT EXISTS lifecycle_status text,
  ADD COLUMN IF NOT EXISTS lifecycle_note text,
  ADD COLUMN IF NOT EXISTS merged_into_edition_id uuid
    REFERENCES public.event_editions (id) ON DELETE RESTRICT;

ALTER TABLE public.event_editions
  DROP CONSTRAINT IF EXISTS event_editions_lifecycle_status_check;

ALTER TABLE public.event_editions
  ADD CONSTRAINT event_editions_lifecycle_status_check
  CHECK (
    lifecycle_status IS NULL
    OR lifecycle_status IN ('active', 'discontinued', 'merged')
  );

ALTER TABLE public.event_editions
  DROP CONSTRAINT IF EXISTS event_editions_merged_into_requires_status;

ALTER TABLE public.event_editions
  ADD CONSTRAINT event_editions_merged_into_requires_status
  CHECK (
    merged_into_edition_id IS NULL
    OR lifecycle_status = 'merged'
  );

ALTER TABLE public.event_editions
  DROP CONSTRAINT IF EXISTS event_editions_merged_status_requires_target;

ALTER TABLE public.event_editions
  ADD CONSTRAINT event_editions_merged_status_requires_target
  CHECK (
    lifecycle_status IS DISTINCT FROM 'merged'
    OR merged_into_edition_id IS NOT NULL
  );

ALTER TABLE public.event_editions
  DROP CONSTRAINT IF EXISTS event_editions_no_self_merge;

ALTER TABLE public.event_editions
  ADD CONSTRAINT event_editions_no_self_merge
  CHECK (
    merged_into_edition_id IS NULL
    OR merged_into_edition_id <> id
  );

CREATE INDEX IF NOT EXISTS event_editions_merged_into_edition_id_idx
  ON public.event_editions (merged_into_edition_id)
  WHERE merged_into_edition_id IS NOT NULL;
