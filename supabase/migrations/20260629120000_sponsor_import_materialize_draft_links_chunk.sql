-- Phase 2 draft-link chunking: action log type for per-chunk audit entries

ALTER TYPE public.sponsor_import_action_type ADD VALUE IF NOT EXISTS 'materialize_draft_links_chunk';
