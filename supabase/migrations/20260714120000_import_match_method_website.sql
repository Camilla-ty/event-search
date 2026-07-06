-- Add website match method for no_identity URL matching (shared sponsor + PA import).

ALTER TYPE public.sponsor_import_match_method ADD VALUE IF NOT EXISTS 'website';

ALTER TYPE public.partner_alumni_import_match_method ADD VALUE IF NOT EXISTS 'website';
