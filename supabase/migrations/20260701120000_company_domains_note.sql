-- Phase 7 (company domain matching): optional admin note on company_domains.
-- See docs/adr/ADR-001-company-identity.md
--
-- note is internal admin metadata only (not exposed on public company pages).
-- No backfill; existing rows remain note = NULL until set by a future admin UI.

ALTER TABLE public.company_domains
  ADD COLUMN note text NULL;

COMMENT ON COLUMN public.company_domains.note IS
  'Optional internal admin note (e.g. regional site, legacy URL). Not shown publicly.';
