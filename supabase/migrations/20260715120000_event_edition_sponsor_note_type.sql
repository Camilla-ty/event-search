-- Controlled sponsor absence explanations on event editions (public when live roster is empty).

ALTER TABLE public.event_editions
  ADD COLUMN IF NOT EXISTS sponsor_note_type text;

ALTER TABLE public.event_editions
  DROP CONSTRAINT IF EXISTS event_editions_sponsor_note_type_check;

ALTER TABLE public.event_editions
  ADD CONSTRAINT event_editions_sponsor_note_type_check
  CHECK (
    sponsor_note_type IS NULL
    OR sponsor_note_type IN ('upcoming_pending', 'virtual_covid')
  );
