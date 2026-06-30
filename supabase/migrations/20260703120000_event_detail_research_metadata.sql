-- Event detail Phase 3A/3B: edition research fields + series lifecycle metadata.

ALTER TABLE public.event_editions
  ADD COLUMN IF NOT EXISTS last_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS primary_source_url text;

ALTER TABLE public.event_series
  ADD COLUMN IF NOT EXISTS lifecycle_status text,
  ADD COLUMN IF NOT EXISTS lifecycle_note text;

ALTER TABLE public.event_series
  DROP CONSTRAINT IF EXISTS event_series_lifecycle_status_check;

ALTER TABLE public.event_series
  ADD CONSTRAINT event_series_lifecycle_status_check
  CHECK (
    lifecycle_status IS NULL
    OR lifecycle_status IN ('active', 'discontinued', 'rebranded', 'merged')
  );
