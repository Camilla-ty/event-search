-- MVP: edition-original sponsor tier display names on live links.
-- tier_rank remains canonical for sort, analytics, RLS, and imports.

ALTER TABLE public.event_sponsors
  ADD COLUMN IF NOT EXISTS tier_label text NULL;
