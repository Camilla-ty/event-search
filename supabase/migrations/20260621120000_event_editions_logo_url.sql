-- Optional edition-level logo override (falls back to event_series.logo_url in app layer).

ALTER TABLE public.event_editions
  ADD COLUMN IF NOT EXISTS logo_url text;
