-- Former / alternate company names for admin search (canonical name stays on companies.name).

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS aliases text[] NOT NULL DEFAULT '{}';
