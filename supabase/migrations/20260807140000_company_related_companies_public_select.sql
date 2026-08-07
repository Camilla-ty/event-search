-- Related Companies Phase 5: allow public read of undirected edges.
-- Writes remain service_role-only (no INSERT/UPDATE/DELETE for anon/authenticated).
-- App filters restricted / non-active related companies when resolving public profiles.

CREATE POLICY company_related_companies_select_public
  ON public.company_related_companies
  FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON TABLE public.company_related_companies TO anon, authenticated;
