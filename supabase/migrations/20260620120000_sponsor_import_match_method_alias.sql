-- Import matching Phase 1: alias as a distinct auto-ready match method.

ALTER TYPE public.sponsor_import_match_method ADD VALUE IF NOT EXISTS 'alias';
