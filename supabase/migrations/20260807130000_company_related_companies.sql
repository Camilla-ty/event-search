-- Related Companies V1 (Phase 2): undirected pair links between existing companies.
--
-- Semantics: admin-asserted "these two companies are closely related."
-- Not merge, not parent/child, not same-brand Series↔Company (ADR-004), not shared identity (ADR-001).
--
-- V1 deliberately omits: relationship types, notes, created_by, hierarchy, auto-suggestions.
-- Merge rewrite of these edges is deferred; ON DELETE RESTRICT keeps pairs intact if a
-- company row is deleted (merge soft-tombstones and does not delete company rows).

CREATE TABLE public.company_related_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_a_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE RESTRICT,
  company_b_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_related_companies_distinct CHECK (company_a_id <> company_b_id),
  CONSTRAINT company_related_companies_ordered CHECK (company_a_id < company_b_id),
  CONSTRAINT company_related_companies_pair_unique UNIQUE (company_a_id, company_b_id)
);

CREATE INDEX company_related_companies_a_idx
  ON public.company_related_companies (company_a_id);

CREATE INDEX company_related_companies_b_idx
  ON public.company_related_companies (company_b_id);

COMMENT ON TABLE public.company_related_companies IS
  'Undirected Related Companies links (V1). One row per unordered pair; company_a_id < company_b_id.';

ALTER TABLE public.company_related_companies ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.company_related_companies FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.company_related_companies TO service_role;
