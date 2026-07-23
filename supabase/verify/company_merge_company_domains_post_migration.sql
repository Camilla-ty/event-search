-- Post-migration checks for company merge company_domains reconcile.
-- Run manually after applying 20260723140000_company_merge_company_domains.sql.

-- Helpers exist
SELECT
  to_regprocedure('public._company_merge_third_party_domain_blockers(uuid,uuid,text)') IS NOT NULL
    AS has_third_party_blockers,
  to_regprocedure('public._company_merge_assert_identity_assertions(text,text,jsonb)') IS NOT NULL
    AS has_identity_assertions,
  to_regprocedure('public._company_merge_reconcile_company_domains(uuid,uuid,text)') IS NOT NULL
    AS has_reconcile;

-- Preview function still callable (service_role)
-- SELECT public.company_merge_preview('<canonical>'::uuid, '<duplicate>'::uuid);
