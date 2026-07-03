-- Remove unused admin-only lifecycle_note from event_series.

ALTER TABLE public.event_series
  DROP COLUMN IF EXISTS lifecycle_note;
