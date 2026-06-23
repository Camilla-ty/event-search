-- M1–M2: company materialization chunking (processing phase + action log type)

ALTER TYPE public.sponsor_import_processing_phase ADD VALUE IF NOT EXISTS 'materializing_companies';

ALTER TYPE public.sponsor_import_action_type ADD VALUE IF NOT EXISTS 'materialize_companies_chunk';
