-- Remove the Event Edition "Primary source URL" research field.
--
-- The column had no database dependencies (no index, constraint, trigger, view,
-- or function referenced it) and the application code no longer reads or writes
-- it. Dropping the column also deletes its 81 stored values, which is intended:
-- 69 duplicated the edition's own website_url and no value is being preserved.
--
-- Scope note: event_partner_alumni_versions.primary_source_url is a separate
-- Partner Alumni field and is deliberately untouched.

ALTER TABLE public.event_editions
  DROP COLUMN IF EXISTS primary_source_url;
