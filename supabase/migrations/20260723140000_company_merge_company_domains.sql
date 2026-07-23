-- Company merge: move company_domains to canonical, one Primary, tombstone keeps none.
-- Website ↔ Primary Identity alignment is asserted via resolutions.identity_assertions
-- (computed by admin using resolveCompanyWebsiteIdentity).

CREATE OR REPLACE FUNCTION public._company_merge_third_party_domain_blockers(
  p_canonical_company_id uuid,
  p_duplicate_company_id uuid,
  p_winner_domain text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_blockers jsonb := '[]'::jsonb;
  v_identity text;
  v_owner_id uuid;
  v_owner_name text;
BEGIN
  -- Identities claimed by either company via company_domains, plus optional winner.
  FOR v_identity, v_owner_id, v_owner_name IN
    WITH claimed AS (
      SELECT DISTINCT lower(trim(cd.domain)) AS identity_key
      FROM public.company_domains cd
      WHERE cd.company_id IN (p_canonical_company_id, p_duplicate_company_id)
        AND trim(cd.domain) <> ''
      UNION
      SELECT lower(trim(p_winner_domain))
      WHERE p_winner_domain IS NOT NULL AND trim(p_winner_domain) <> ''
    )
    SELECT
      c.identity_key,
      owner.company_id,
      owner.company_name
    FROM claimed c
    CROSS JOIN LATERAL (
      SELECT cd.company_id, co.name AS company_name
      FROM public.company_domains cd
      INNER JOIN public.companies co ON co.id = cd.company_id
      WHERE lower(trim(cd.domain)) = c.identity_key
        AND cd.company_id NOT IN (p_canonical_company_id, p_duplicate_company_id)
      LIMIT 1
    ) owner
  LOOP
    v_blockers := v_blockers || jsonb_build_array(
      format(
        'Identity "%s" is owned by another company (%s). Resolve that conflict before merging.',
        v_identity,
        v_owner_name
      )
    );
  END LOOP;

  FOR v_identity, v_owner_id, v_owner_name IN
    WITH claimed AS (
      SELECT DISTINCT lower(trim(cd.domain)) AS identity_key
      FROM public.company_domains cd
      WHERE cd.company_id IN (p_canonical_company_id, p_duplicate_company_id)
        AND trim(cd.domain) <> ''
      UNION
      SELECT lower(trim(p_winner_domain))
      WHERE p_winner_domain IS NOT NULL AND trim(p_winner_domain) <> ''
    )
    SELECT
      c.identity_key,
      co.id,
      co.name
    FROM claimed c
    INNER JOIN public.companies co
      ON lower(trim(co.domain)) = c.identity_key
     AND co.status = 'active'::public.company_status
     AND co.id NOT IN (p_canonical_company_id, p_duplicate_company_id)
  LOOP
    v_blockers := v_blockers || jsonb_build_array(
      format(
        'Identity "%s" is owned by another company (%s). Resolve that conflict before merging.',
        v_identity,
        v_owner_name
      )
    );
  END LOOP;

  RETURN v_blockers;
END;
$$;

COMMENT ON FUNCTION public._company_merge_third_party_domain_blockers(uuid, uuid, text) IS
  'Preview/execute blockers when a merge would claim an identity owned by a third company.';

REVOKE ALL ON FUNCTION public._company_merge_third_party_domain_blockers(uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._company_merge_third_party_domain_blockers(uuid, uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public._company_merge_third_party_domain_blockers(uuid, uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public._company_merge_assert_no_third_party_domain_owners(
  p_canonical_company_id uuid,
  p_duplicate_company_id uuid,
  p_winner_domain text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_blockers jsonb;
BEGIN
  v_blockers := public._company_merge_third_party_domain_blockers(
    p_canonical_company_id,
    p_duplicate_company_id,
    p_winner_domain
  );
  IF jsonb_array_length(v_blockers) > 0 THEN
    RAISE EXCEPTION 'merge_company_domain_third_party'
      USING MESSAGE = v_blockers ->> 0;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public._company_merge_assert_no_third_party_domain_owners(uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._company_merge_assert_no_third_party_domain_owners(uuid, uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public._company_merge_assert_no_third_party_domain_owners(uuid, uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public._company_merge_assert_identity_assertions(
  p_winner_domain text,
  p_winner_website text,
  p_assertions jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assert_domain text;
  v_assert_website text;
  v_status text;
  v_identity_key text;
  v_norm_domain text;
  v_norm_website text;
BEGIN
  IF p_assertions IS NULL OR p_assertions = 'null'::jsonb THEN
    RAISE EXCEPTION 'merge_identity_assertions_required'
      USING MESSAGE = 'Merge identity_assertions are required (website must align with Primary Identity).';
  END IF;

  v_assert_domain := NULLIF(trim(COALESCE(p_assertions ->> 'winner_domain', '')), '');
  v_assert_website := NULLIF(trim(COALESCE(p_assertions ->> 'winner_website', '')), '');
  v_status := COALESCE(p_assertions ->> 'website_identity_status', '');
  v_identity_key := NULLIF(trim(COALESCE(p_assertions ->> 'website_identity_key', '')), '');

  v_norm_domain := NULLIF(trim(COALESCE(p_winner_domain, '')), '');
  v_norm_website := NULLIF(trim(COALESCE(p_winner_website, '')), '');

  IF v_assert_domain IS DISTINCT FROM v_norm_domain THEN
    RAISE EXCEPTION 'merge_identity_assertion_mismatch'
      USING MESSAGE = 'identity_assertions.winner_domain does not match selected Primary Identity.';
  END IF;

  IF v_assert_website IS DISTINCT FROM v_norm_website THEN
    RAISE EXCEPTION 'merge_identity_assertion_mismatch'
      USING MESSAGE = 'identity_assertions.winner_website does not match selected website.';
  END IF;

  IF v_status = 'unparseable' THEN
    RAISE EXCEPTION 'merge_website_unparseable'
      USING MESSAGE = 'Selected website is not a usable URL. Fix the website before merging.';
  END IF;

  IF v_status = 'no_identity' AND v_norm_domain IS NOT NULL THEN
    RAISE EXCEPTION 'merge_website_no_identity_with_primary'
      USING MESSAGE = 'Selected website has no Match Key, but a Primary Identity is selected.';
  END IF;

  IF v_status = 'domain' AND v_norm_domain IS NULL THEN
    RAISE EXCEPTION 'merge_website_identity_without_primary'
      USING MESSAGE = 'Selected website resolves to a Match Key, but Primary Identity is empty.';
  END IF;

  IF v_status = 'domain'
     AND lower(v_identity_key) IS DISTINCT FROM lower(v_norm_domain) THEN
    RAISE EXCEPTION 'merge_website_primary_identity_mismatch'
      USING MESSAGE = 'Resolved website identity must match the selected Primary Identity (domain).';
  END IF;

  IF v_status NOT IN ('domain', 'no_identity', 'blank', 'unparseable') THEN
    RAISE EXCEPTION 'merge_identity_assertion_mismatch'
      USING MESSAGE = 'identity_assertions.website_identity_status is invalid.';
  END IF;
END;
$$;

COMMENT ON FUNCTION public._company_merge_assert_identity_assertions(text, text, jsonb) IS
  'Execute-time check: website identity assertions must match selected domain/website winners.';

REVOKE ALL ON FUNCTION public._company_merge_assert_identity_assertions(text, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._company_merge_assert_identity_assertions(text, text, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public._company_merge_assert_identity_assertions(text, text, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public._company_merge_reconcile_company_domains(
  p_canonical_company_id uuid,
  p_duplicate_company_id uuid,
  p_winner_domain text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_moved integer := 0;
  v_deleted integer := 0;
  v_primary_synced boolean := false;
  v_winner text;
  v_remaining integer;
  v_primary_count integer;
  v_primary_domain text;
BEGIN
  v_winner := NULLIF(trim(COALESCE(p_winner_domain, '')), '');

  -- Delete duplicate rows that overlap canonical identities.
  WITH deleted AS (
    DELETE FROM public.company_domains d
    WHERE d.company_id = p_duplicate_company_id
      AND EXISTS (
        SELECT 1
        FROM public.company_domains c
        WHERE c.company_id = p_canonical_company_id
          AND lower(trim(c.domain)) = lower(trim(d.domain))
      )
    RETURNING d.id
  )
  SELECT COUNT(*)::integer INTO v_deleted FROM deleted;

  WITH moved AS (
    UPDATE public.company_domains d
    SET
      company_id = p_canonical_company_id,
      is_primary = false
    WHERE d.company_id = p_duplicate_company_id
    RETURNING d.id
  )
  SELECT COUNT(*)::integer INTO v_moved FROM moved;

  -- Exactly one Primary matching companies.domain (winner), or none if null.
  UPDATE public.company_domains
  SET is_primary = false
  WHERE company_id = p_canonical_company_id
    AND is_primary = true;

  IF v_winner IS NOT NULL THEN
    UPDATE public.company_domains
    SET is_primary = true
    WHERE company_id = p_canonical_company_id
      AND lower(trim(domain)) = lower(v_winner);

    GET DIAGNOSTICS v_remaining = ROW_COUNT;
    IF v_remaining = 0 THEN
      INSERT INTO public.company_domains (company_id, domain, is_primary)
      VALUES (p_canonical_company_id, v_winner, true);
    END IF;
    v_primary_synced := true;
  END IF;

  SELECT COUNT(*)::integer
  INTO v_remaining
  FROM public.company_domains
  WHERE company_id = p_duplicate_company_id;

  IF v_remaining <> 0 THEN
    RAISE EXCEPTION 'merge_company_domains_tombstone_not_empty'
      USING MESSAGE = 'Duplicate company still has company_domains after reconcile.';
  END IF;

  SELECT COUNT(*)::integer, MAX(domain)
  INTO v_primary_count, v_primary_domain
  FROM public.company_domains
  WHERE company_id = p_canonical_company_id
    AND is_primary = true;

  IF v_winner IS NULL THEN
    IF v_primary_count <> 0 THEN
      RAISE EXCEPTION 'merge_company_domains_primary_invariant'
        USING MESSAGE = 'Expected no primary company_domains when companies.domain is null.';
    END IF;
  ELSE
    IF v_primary_count <> 1 OR lower(trim(v_primary_domain)) IS DISTINCT FROM lower(v_winner) THEN
      RAISE EXCEPTION 'merge_company_domains_primary_invariant'
        USING MESSAGE = 'Primary company_domains must exactly match selected companies.domain.';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'moved', v_moved,
    'deleted_overlap', v_deleted,
    'primary_synced', v_primary_synced
  );
END;
$$;

COMMENT ON FUNCTION public._company_merge_reconcile_company_domains(uuid, uuid, text) IS
  'Move duplicate company_domains to canonical, dedupe overlaps, sync single Primary.';

REVOKE ALL ON FUNCTION public._company_merge_reconcile_company_domains(uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._company_merge_reconcile_company_domains(uuid, uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public._company_merge_reconcile_company_domains(uuid, uuid, text) TO service_role;

-- Preview: third-party identity blockers
CREATE OR REPLACE FUNCTION public._company_merge_build_preview(
  p_canonical_company_id uuid,
  p_duplicate_company_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_canonical jsonb;
  v_duplicate jsonb;
  v_event_sponsors_to_repoint integer;
  v_event_edition_organizers_to_repoint integer;
  v_import_rows_proposed_to_repoint integer;
  v_import_rows_resolved_to_repoint integer;
  v_draft_links_to_repoint integer;
  v_partner_alumni_version_members_to_repoint integer := 0;
  v_partner_alumni_version_conflicts jsonb := '[]'::jsonb;
  v_sponsorship_conflicts jsonb;
  v_organizer_conflicts jsonb;
  v_draft_link_conflicts jsonb;
  v_required_sponsorship jsonb;
  v_required_organizer jsonb;
  v_required_draft jsonb;
  v_warnings jsonb := '[]'::jsonb;
  v_blockers jsonb := '[]'::jsonb;
  v_executable boolean;
BEGIN
  v_canonical := public._company_merge_company_snapshot(p_canonical_company_id);
  v_duplicate := public._company_merge_company_snapshot(p_duplicate_company_id);

  IF v_canonical IS NULL OR v_duplicate IS NULL THEN
    RAISE EXCEPTION 'merge_snapshot_failed';
  END IF;

  SELECT COUNT(*)::integer
  INTO v_event_sponsors_to_repoint
  FROM public.event_sponsors es
  WHERE es.company_id = p_duplicate_company_id;

  SELECT COUNT(*)::integer
  INTO v_event_edition_organizers_to_repoint
  FROM public.event_edition_organizers eeo
  WHERE eeo.company_id = p_duplicate_company_id;

  SELECT COUNT(*)::integer
  INTO v_import_rows_proposed_to_repoint
  FROM public.sponsor_import_rows sir
  WHERE sir.proposed_company_id = p_duplicate_company_id;

  SELECT COUNT(*)::integer
  INTO v_import_rows_resolved_to_repoint
  FROM public.sponsor_import_rows sir
  WHERE sir.resolved_company_id = p_duplicate_company_id;

  SELECT COUNT(*)::integer
  INTO v_draft_links_to_repoint
  FROM public.sponsor_import_draft_links sdl
  WHERE sdl.company_id = p_duplicate_company_id;

  IF to_regclass('public.event_partner_alumni_version_companies') IS NOT NULL THEN
    SELECT COUNT(*)::integer
    INTO v_partner_alumni_version_members_to_repoint
    FROM public.event_partner_alumni_version_companies pavc
    WHERE pavc.company_id = p_duplicate_company_id;

    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'event_partner_alumni_version_id', pavc_dup.event_partner_alumni_version_id,
          'version_label', epav.version_label,
          'canonical_link', jsonb_build_object(
            'version_member_id', pavc_can.id,
            'display_order', pavc_can.display_order
          ),
          'duplicate_link', jsonb_build_object(
            'version_member_id', pavc_dup.id,
            'display_order', pavc_dup.display_order
          ),
          'note', 'both companies on same version — auto-dedupe on merge'
        )
        ORDER BY epav.created_at DESC NULLS LAST, epav.version_label
      ),
      '[]'::jsonb
    )
    INTO v_partner_alumni_version_conflicts
    FROM public.event_partner_alumni_version_companies pavc_dup
    INNER JOIN public.event_partner_alumni_version_companies pavc_can
      ON pavc_can.event_partner_alumni_version_id = pavc_dup.event_partner_alumni_version_id
      AND pavc_can.company_id = p_canonical_company_id
    INNER JOIN public.event_partner_alumni_versions epav
      ON epav.id = pavc_dup.event_partner_alumni_version_id
    WHERE pavc_dup.company_id = p_duplicate_company_id;
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'event_edition_id', es_dup.event_editions_id,
        'edition_name', ee.name,
        'edition_year', ee.year,
        'edition_slug', ee.slug,
        'canonical_link', jsonb_build_object(
          'event_sponsor_id', es_can.id,
          'tier_rank', es_can.tier_rank,
          'tier_label', es_can.tier_label,
          'display_order', es_can.display_order
        ),
        'duplicate_link', jsonb_build_object(
          'event_sponsor_id', es_dup.id,
          'tier_rank', es_dup.tier_rank,
          'tier_label', es_dup.tier_label,
          'display_order', es_dup.display_order
        )
      )
      ORDER BY ee.year DESC NULLS LAST, ee.name
    ),
    '[]'::jsonb
  )
  INTO v_sponsorship_conflicts
  FROM public.event_sponsors es_dup
  INNER JOIN public.event_sponsors es_can
    ON es_can.event_editions_id = es_dup.event_editions_id
    AND es_can.company_id = p_canonical_company_id
  INNER JOIN public.event_editions ee
    ON ee.id = es_dup.event_editions_id
  WHERE es_dup.company_id = p_duplicate_company_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'event_edition_id', eeo_dup.event_editions_id,
        'edition_name', ee.name,
        'edition_year', ee.year,
        'edition_slug', ee.slug,
        'canonical_link', jsonb_build_object(
          'event_edition_organizer_id', eeo_can.id,
          'role_label', eeo_can.role_label,
          'display_order', eeo_can.display_order
        ),
        'duplicate_link', jsonb_build_object(
          'event_edition_organizer_id', eeo_dup.id,
          'role_label', eeo_dup.role_label,
          'display_order', eeo_dup.display_order
        )
      )
      ORDER BY ee.year DESC NULLS LAST, ee.name
    ),
    '[]'::jsonb
  )
  INTO v_organizer_conflicts
  FROM public.event_edition_organizers eeo_dup
  INNER JOIN public.event_edition_organizers eeo_can
    ON eeo_can.event_editions_id = eeo_dup.event_editions_id
    AND eeo_can.company_id = p_canonical_company_id
  INNER JOIN public.event_editions ee
    ON ee.id = eeo_dup.event_editions_id
  WHERE eeo_dup.company_id = p_duplicate_company_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'batch_id', dl_dup.batch_id,
        'event_edition_id', dl_dup.event_edition_id,
        'canonical_draft_link_id', dl_can.id,
        'duplicate_draft_link_id', dl_dup.id,
        'note', 'canonical already has draft link in same batch'
      )
      ORDER BY dl_dup.batch_id
    ),
    '[]'::jsonb
  )
  INTO v_draft_link_conflicts
  FROM public.sponsor_import_draft_links dl_dup
  INNER JOIN public.sponsor_import_draft_links dl_can
    ON dl_can.batch_id = dl_dup.batch_id
    AND dl_can.company_id = p_canonical_company_id
  WHERE dl_dup.company_id = p_duplicate_company_id;

  SELECT COALESCE(jsonb_agg(value -> 'event_edition_id' ORDER BY value -> 'event_edition_id'), '[]'::jsonb)
  INTO v_required_sponsorship
  FROM jsonb_array_elements(v_sponsorship_conflicts);

  SELECT COALESCE(jsonb_agg(value -> 'event_edition_id' ORDER BY value -> 'event_edition_id'), '[]'::jsonb)
  INTO v_required_organizer
  FROM jsonb_array_elements(v_organizer_conflicts);

  SELECT COALESCE(jsonb_agg(value -> 'batch_id' ORDER BY value -> 'batch_id'), '[]'::jsonb)
  INTO v_required_draft
  FROM jsonb_array_elements(v_draft_link_conflicts);

  IF (v_canonical ->> 'domain') IS DISTINCT FROM (v_duplicate ->> 'domain') THEN
    v_warnings := v_warnings || jsonb_build_array('duplicate_has_different_domain');
  END IF;

  IF (v_canonical ->> 'slug') IS DISTINCT FROM (v_duplicate ->> 'slug') THEN
    v_warnings := v_warnings || jsonb_build_array('duplicate_slug_will_need_redirect');
  END IF;

  -- Third-party identity ownership (resolution-independent).
  -- Website ↔ Primary Identity alignment is enforced in the admin planner
  -- (resolveCompanyWebsiteIdentity) and re-checked at execute via identity_assertions.
  v_blockers := public._company_merge_third_party_domain_blockers(
    p_canonical_company_id,
    p_duplicate_company_id,
    NULLIF(trim(COALESCE(v_canonical ->> 'domain', '')), '')
  );

  v_executable :=
    jsonb_array_length(v_required_sponsorship) = 0
    AND jsonb_array_length(v_required_organizer) = 0
    AND jsonb_array_length(v_required_draft) = 0
    AND jsonb_array_length(v_blockers) = 0;

  RETURN jsonb_build_object(
    'schema_version', 2,
    'generated_at', now(),
    'canonical_company_id', p_canonical_company_id,
    'duplicate_company_id', p_duplicate_company_id,
    'companies', jsonb_build_object(
      'canonical', v_canonical,
      'duplicate', v_duplicate
    ),
    'impact', jsonb_build_object(
      'event_sponsors_to_repoint', v_event_sponsors_to_repoint,
      'event_edition_organizers_to_repoint', v_event_edition_organizers_to_repoint,
      'import_rows_proposed_to_repoint', v_import_rows_proposed_to_repoint,
      'import_rows_resolved_to_repoint', v_import_rows_resolved_to_repoint,
      'draft_links_to_repoint', v_draft_links_to_repoint,
      'partner_alumni_version_members_to_repoint', v_partner_alumni_version_members_to_repoint
    ),
    'sponsorship_conflicts', v_sponsorship_conflicts,
    'organizer_conflicts', v_organizer_conflicts,
    'draft_link_conflicts', v_draft_link_conflicts,
    'partner_alumni_version_conflicts', v_partner_alumni_version_conflicts,
    'required_resolutions', jsonb_build_object(
      'sponsorship_conflicts', v_required_sponsorship,
      'organizer_conflicts', v_required_organizer,
      'draft_link_conflicts', v_required_draft
    ),
    'field_differences', jsonb_build_object(
      'slug', jsonb_build_object(
        'canonical', v_canonical -> 'slug',
        'duplicate', v_duplicate -> 'slug'
      ),
      'domain', jsonb_build_object(
        'canonical', v_canonical -> 'domain',
        'duplicate', v_duplicate -> 'domain'
      ),
      'website', jsonb_build_object(
        'canonical', v_canonical -> 'website',
        'duplicate', v_duplicate -> 'website'
      ),
      'logo_url', jsonb_build_object(
        'canonical', v_canonical -> 'logo_url',
        'duplicate', v_duplicate -> 'logo_url'
      ),
      'aliases', jsonb_build_object(
        'canonical', v_canonical -> 'aliases',
        'duplicate', v_duplicate -> 'aliases',
        'union_preview', (
          SELECT COALESCE(jsonb_agg(DISTINCT alias_value ORDER BY alias_value), '[]'::jsonb)
          FROM (
            SELECT jsonb_array_elements_text(v_canonical -> 'aliases') AS alias_value
            UNION
            SELECT jsonb_array_elements_text(v_duplicate -> 'aliases') AS alias_value
            UNION
            SELECT v_duplicate ->> 'name'
          ) alias_union
          WHERE alias_value IS NOT NULL AND alias_value <> ''
        )
      )
    ),
    'blockers', v_blockers,
    'warnings', v_warnings,
    'executable', v_executable,
    'executable_in_phase', v_executable
  );
END;
$$;



COMMENT ON FUNCTION public._company_merge_build_preview(uuid, uuid) IS
  'Read-only company merge preview snapshot (includes company_domains third-party blockers).';

REVOKE ALL ON FUNCTION public._company_merge_build_preview(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._company_merge_build_preview(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public._company_merge_build_preview(uuid, uuid) TO service_role;

-- Execute: identity assertions + company_domains reconcile before tombstone
CREATE OR REPLACE FUNCTION public.merge_companies(
  p_canonical_company_id uuid,
  p_duplicate_company_id uuid,
  p_performed_by uuid,
  p_resolutions jsonb DEFAULT '{}'::jsonb,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_canonical public.companies%ROWTYPE;
  v_duplicate public.companies%ROWTYPE;
  v_canonical_before jsonb;
  v_duplicate_before jsonb;
  v_preview jsonb;
  v_resolutions jsonb;
  v_field_resolutions jsonb;
  v_execution jsonb;
  v_merge_id uuid;
  v_conflict jsonb;
  v_edition_id uuid;
  v_batch_id uuid;
  v_strategy text;
  v_dup_sponsor public.event_sponsors%ROWTYPE;
  v_can_sponsor public.event_sponsors%ROWTYPE;
  v_dup_draft public.sponsor_import_draft_links%ROWTYPE;
  v_can_draft public.sponsor_import_draft_links%ROWTYPE;
  v_event_sponsors_repointed integer := 0;
  v_event_sponsors_deleted integer := 0;
  v_event_sponsors_updated integer := 0;
  v_import_rows_proposed_repointed integer := 0;
  v_import_rows_resolved_repointed integer := 0;
  v_draft_links_repointed integer := 0;
  v_draft_links_deleted integer := 0;
  v_slug_redirects_created integer := 0;
  v_repointed_sponsors jsonb := '[]'::jsonb;
  v_deleted_sponsors jsonb := '[]'::jsonb;
  v_updated_sponsors jsonb := '[]'::jsonb;
  v_import_rows_proposed jsonb := '[]'::jsonb;
  v_import_rows_resolved jsonb := '[]'::jsonb;
  v_draft_links_repointed_log jsonb := '[]'::jsonb;
  v_draft_links_deleted_log jsonb := '[]'::jsonb;
  v_slug_redirects jsonb := '[]'::jsonb;
  v_alias_merge jsonb;
  v_final_aliases text[];
  v_winner_slug text;
  v_loser_slug text;
  v_tombstone_slug text;
  v_winner_domain text;
  v_domain_strategy text;
  v_canonical_logo_score integer;
  v_duplicate_logo_score integer;
  v_logo_source text;
  v_city_id uuid;
  v_organizer_result jsonb;
  v_partner_alumni_result jsonb;
  v_winner_website text;
  v_domains_reconcile jsonb;
BEGIN
  PERFORM public._company_merge_assert_preconditions(
    p_canonical_company_id,
    p_duplicate_company_id,
    true,
    p_performed_by
  );

  IF p_canonical_company_id < p_duplicate_company_id THEN
    PERFORM 1 FROM public.companies WHERE id = p_canonical_company_id FOR UPDATE;
    PERFORM 1 FROM public.companies WHERE id = p_duplicate_company_id FOR UPDATE;
  ELSE
    PERFORM 1 FROM public.companies WHERE id = p_duplicate_company_id FOR UPDATE;
    PERFORM 1 FROM public.companies WHERE id = p_canonical_company_id FOR UPDATE;
  END IF;

  PERFORM 1
  FROM public.event_sponsors
  WHERE company_id IN (p_canonical_company_id, p_duplicate_company_id)
  FOR UPDATE;

  PERFORM 1
  FROM public.event_edition_organizers
  WHERE company_id IN (p_canonical_company_id, p_duplicate_company_id)
  FOR UPDATE;

  IF to_regclass('public.event_partner_alumni_version_companies') IS NOT NULL THEN
    PERFORM 1
    FROM public.event_partner_alumni_version_companies
    WHERE company_id IN (p_canonical_company_id, p_duplicate_company_id)
    FOR UPDATE;
  END IF;

  SELECT * INTO v_canonical FROM public.companies WHERE id = p_canonical_company_id;
  SELECT * INTO v_duplicate FROM public.companies WHERE id = p_duplicate_company_id;

  v_canonical_before := public._company_merge_company_row_json(p_canonical_company_id);
  v_duplicate_before := public._company_merge_company_row_json(p_duplicate_company_id);

  v_preview := public._company_merge_build_preview(
    p_canonical_company_id,
    p_duplicate_company_id
  );

  IF public._company_merge_duplicate_has_dependencies(p_duplicate_company_id) THEN
    v_resolutions := public._company_merge_validate_resolutions(v_preview, p_resolutions);
  ELSE
    v_resolutions := public._company_merge_validate_resolutions(
      v_preview,
      CASE
        WHEN COALESCE(p_resolutions, '{}'::jsonb) = '{}'::jsonb THEN
          jsonb_build_object(
            'schema_version', 2,
            'sponsorship_conflicts', '[]'::jsonb,
            'draft_link_conflicts', '[]'::jsonb,
            'organizer_conflicts', '[]'::jsonb,
            'field_resolutions', public._company_merge_default_field_resolutions()
          )
        ELSE p_resolutions
      END
    );
  END IF;

  v_field_resolutions := v_resolutions -> 'field_resolutions';

  FOR v_conflict IN
    SELECT value FROM jsonb_array_elements(COALESCE(v_preview -> 'sponsorship_conflicts', '[]'::jsonb))
  LOOP
    v_edition_id := (v_conflict ->> 'event_edition_id')::uuid;
    v_strategy := public._company_merge_sponsorship_strategy(v_resolutions, v_edition_id);

    SELECT * INTO v_dup_sponsor
    FROM public.event_sponsors
    WHERE id = (v_conflict -> 'duplicate_link' ->> 'event_sponsor_id')::uuid;

    SELECT * INTO v_can_sponsor
    FROM public.event_sponsors
    WHERE id = (v_conflict -> 'canonical_link' ->> 'event_sponsor_id')::uuid;

    IF v_strategy = 'keep_canonical' THEN
      v_deleted_sponsors := v_deleted_sponsors || jsonb_build_array(
        jsonb_build_object(
          'id', v_dup_sponsor.id,
          'row', jsonb_build_object(
            'company_id', v_dup_sponsor.company_id,
            'event_editions_id', v_dup_sponsor.event_editions_id,
            'tier_rank', v_dup_sponsor.tier_rank,
            'tier_label', v_dup_sponsor.tier_label,
            'display_order', v_dup_sponsor.display_order
          ),
          'reason', 'sponsorship_conflict_keep_canonical',
          'event_edition_id', v_edition_id
        )
      );
      DELETE FROM public.event_sponsors WHERE id = v_dup_sponsor.id;
      v_event_sponsors_deleted := v_event_sponsors_deleted + 1;
    ELSIF v_strategy = 'keep_duplicate_tier' THEN
      v_updated_sponsors := v_updated_sponsors || jsonb_build_array(
        jsonb_build_object(
          'id', v_can_sponsor.id,
          'before', jsonb_build_object(
            'tier_rank', v_can_sponsor.tier_rank,
            'tier_label', v_can_sponsor.tier_label,
            'display_order', v_can_sponsor.display_order
          ),
          'after', jsonb_build_object(
            'tier_rank', v_dup_sponsor.tier_rank,
            'tier_label', v_dup_sponsor.tier_label,
            'display_order', v_dup_sponsor.display_order
          ),
          'reason', 'sponsorship_conflict_keep_duplicate_tier'
        )
      );
      UPDATE public.event_sponsors
      SET
        tier_rank = v_dup_sponsor.tier_rank,
        tier_label = v_dup_sponsor.tier_label,
        display_order = v_dup_sponsor.display_order
      WHERE id = v_can_sponsor.id;

      v_deleted_sponsors := v_deleted_sponsors || jsonb_build_array(
        jsonb_build_object(
          'id', v_dup_sponsor.id,
          'row', jsonb_build_object(
            'company_id', v_dup_sponsor.company_id,
            'event_editions_id', v_dup_sponsor.event_editions_id,
            'tier_rank', v_dup_sponsor.tier_rank,
            'tier_label', v_dup_sponsor.tier_label,
            'display_order', v_dup_sponsor.display_order
          ),
          'reason', 'sponsorship_conflict_keep_duplicate_tier',
          'event_edition_id', v_edition_id
        )
      );
      DELETE FROM public.event_sponsors WHERE id = v_dup_sponsor.id;
      v_event_sponsors_updated := v_event_sponsors_updated + 1;
      v_event_sponsors_deleted := v_event_sponsors_deleted + 1;
    END IF;
  END LOOP;

  WITH repointed AS (
    UPDATE public.event_sponsors es
    SET company_id = p_canonical_company_id
    WHERE es.company_id = p_duplicate_company_id
    RETURNING es.id, es.event_editions_id, es.tier_rank, es.tier_label, es.display_order
  )
  SELECT
    COUNT(*)::integer,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'before', jsonb_build_object(
            'company_id', p_duplicate_company_id,
            'event_editions_id', r.event_editions_id,
            'tier_rank', r.tier_rank,
            'tier_label', r.tier_label,
            'display_order', r.display_order
          ),
          'after', jsonb_build_object(
            'company_id', p_canonical_company_id,
            'event_editions_id', r.event_editions_id,
            'tier_rank', r.tier_rank,
            'tier_label', r.tier_label,
            'display_order', r.display_order
          ),
          'action', 'repointed'
        )
      ),
      '[]'::jsonb
    )
  INTO v_event_sponsors_repointed, v_repointed_sponsors
  FROM repointed r;

  v_organizer_result := public._company_merge_process_organizers(
    p_canonical_company_id,
    p_duplicate_company_id,
    v_preview,
    v_resolutions
  );

  IF to_regclass('public.event_partner_alumni_version_companies') IS NOT NULL THEN
    v_partner_alumni_result := public._company_merge_process_partner_alumni(
      p_canonical_company_id,
      p_duplicate_company_id,
      v_preview
    );
  ELSE
    v_partner_alumni_result := jsonb_build_object(
      'repointed', 0,
      'deleted', 0,
      'updated', 0,
      'repointed_log', '[]'::jsonb,
      'deleted_log', '[]'::jsonb,
      'updated_log', '[]'::jsonb
    );
  END IF;

  FOR v_conflict IN
    SELECT value FROM jsonb_array_elements(COALESCE(v_preview -> 'draft_link_conflicts', '[]'::jsonb))
  LOOP
    v_batch_id := (v_conflict ->> 'batch_id')::uuid;
    v_strategy := public._company_merge_draft_link_strategy(v_resolutions, v_batch_id);

    SELECT * INTO v_dup_draft
    FROM public.sponsor_import_draft_links
    WHERE id = (v_conflict ->> 'duplicate_draft_link_id')::uuid;

    SELECT * INTO v_can_draft
    FROM public.sponsor_import_draft_links
    WHERE id = (v_conflict ->> 'canonical_draft_link_id')::uuid;

    IF v_strategy = 'keep_canonical_draft' THEN
      v_draft_links_deleted_log := v_draft_links_deleted_log || jsonb_build_array(
        jsonb_build_object(
          'id', v_dup_draft.id,
          'row', jsonb_build_object(
            'batch_id', v_dup_draft.batch_id,
            'company_id', v_dup_draft.company_id,
            'tier_rank', v_dup_draft.tier_rank
          ),
          'reason', 'draft_link_conflict_keep_canonical'
        )
      );
      DELETE FROM public.sponsor_import_draft_links WHERE id = v_dup_draft.id;
      v_draft_links_deleted := v_draft_links_deleted + 1;
    ELSIF v_strategy = 'keep_duplicate_draft' THEN
      v_draft_links_deleted_log := v_draft_links_deleted_log || jsonb_build_array(
        jsonb_build_object(
          'id', v_can_draft.id,
          'row', jsonb_build_object(
            'batch_id', v_can_draft.batch_id,
            'company_id', v_can_draft.company_id,
            'tier_rank', v_can_draft.tier_rank
          ),
          'reason', 'draft_link_conflict_keep_duplicate_draft'
        )
      );
      DELETE FROM public.sponsor_import_draft_links WHERE id = v_can_draft.id;
      v_draft_links_deleted := v_draft_links_deleted + 1;
    END IF;
  END LOOP;

  WITH repointed AS (
    UPDATE public.sponsor_import_draft_links sdl
    SET company_id = p_canonical_company_id
    WHERE sdl.company_id = p_duplicate_company_id
    RETURNING sdl.id, sdl.batch_id, sdl.tier_rank
  )
  SELECT
    COUNT(*)::integer,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'before', p_duplicate_company_id,
          'after', p_canonical_company_id
        )
      ),
      '[]'::jsonb
    )
  INTO v_draft_links_repointed, v_draft_links_repointed_log
  FROM repointed r;

  WITH proposed AS (
    UPDATE public.sponsor_import_rows sir
    SET proposed_company_id = p_canonical_company_id
    WHERE sir.proposed_company_id = p_duplicate_company_id
    RETURNING sir.id
  )
  SELECT
    COUNT(*)::integer,
    COALESCE(jsonb_agg(jsonb_build_object('id', p.id, 'before', p_duplicate_company_id, 'after', p_canonical_company_id)), '[]'::jsonb)
  INTO v_import_rows_proposed_repointed, v_import_rows_proposed
  FROM proposed p;

  WITH resolved AS (
    UPDATE public.sponsor_import_rows sir
    SET resolved_company_id = p_canonical_company_id
    WHERE sir.resolved_company_id = p_duplicate_company_id
    RETURNING sir.id
  )
  SELECT
    COUNT(*)::integer,
    COALESCE(jsonb_agg(jsonb_build_object('id', r.id, 'before', p_duplicate_company_id, 'after', p_canonical_company_id)), '[]'::jsonb)
  INTO v_import_rows_resolved_repointed, v_import_rows_resolved
  FROM resolved r;

  v_alias_merge := public._company_merge_merge_aliases(
    v_canonical.name,
    v_canonical.aliases,
    v_duplicate.name,
    v_duplicate.aliases
  );
  v_final_aliases := ARRAY(
    SELECT jsonb_array_elements_text(v_alias_merge -> 'aliases')
  );

  IF v_field_resolutions ->> 'slug' = 'duplicate' THEN
    v_winner_slug := v_duplicate.slug;
    v_loser_slug := v_canonical.slug;
  ELSE
    v_winner_slug := v_canonical.slug;
    v_loser_slug := v_duplicate.slug;
  END IF;

  v_tombstone_slug := public._company_merge_tombstone_slug(p_duplicate_company_id);

  -- Release duplicate slug before canonical claims it (field_resolutions.slug = duplicate).
  IF v_winner_slug IS NOT NULL
     AND trim(v_winner_slug) <> ''
     AND v_winner_slug IS DISTINCT FROM v_canonical.slug
     AND v_winner_slug = v_duplicate.slug THEN
    UPDATE public.companies
    SET slug = v_tombstone_slug
    WHERE id = p_duplicate_company_id;
  END IF;

  v_domain_strategy := CASE
    WHEN v_field_resolutions ->> 'domain' = 'duplicate' THEN 'duplicate'
    WHEN v_field_resolutions ->> 'domain' = 'non_empty' THEN 'non_empty'
    ELSE 'canonical'
  END;

  v_winner_domain := public._company_merge_pick_text_field(
    v_canonical.domain,
    v_duplicate.domain,
    v_domain_strategy
  );

  -- Release duplicate domain before canonical claims it (domain: duplicate / non_empty).
  IF v_winner_domain IS NOT NULL
     AND trim(v_winner_domain) <> ''
     AND v_winner_domain IS DISTINCT FROM v_canonical.domain
     AND v_winner_domain = v_duplicate.domain THEN
    UPDATE public.companies
    SET domain = NULL
    WHERE id = p_duplicate_company_id;
  END IF;

  v_canonical_logo_score := public._company_merge_logo_score(
    v_canonical.logo_url, v_canonical.logo_source, v_canonical.logo_status
  );
  v_duplicate_logo_score := public._company_merge_logo_score(
    v_duplicate.logo_url, v_duplicate.logo_source, v_duplicate.logo_status
  );

  IF v_field_resolutions ->> 'logo' = 'duplicate' THEN
    v_logo_source := 'duplicate';
  ELSIF v_field_resolutions ->> 'logo' = 'canonical' THEN
    v_logo_source := 'canonical';
  ELSIF v_duplicate_logo_score > v_canonical_logo_score THEN
    v_logo_source := 'duplicate';
  ELSE
    v_logo_source := 'canonical';
  END IF;

  v_city_id := v_canonical.city_id;
  IF v_city_id IS NULL THEN
    v_city_id := v_duplicate.city_id;
  END IF;

  UPDATE public.companies
  SET
    slug = v_winner_slug,
    domain = v_winner_domain,
    website = public._company_merge_pick_text_field(
      v_canonical.website,
      v_duplicate.website,
      CASE
        WHEN v_field_resolutions ->> 'website' = 'duplicate' THEN 'duplicate'
        WHEN v_field_resolutions ->> 'website' = 'non_empty' THEN 'non_empty'
        ELSE 'canonical'
      END
    ),
    logo_url = CASE WHEN v_logo_source = 'duplicate' THEN v_duplicate.logo_url ELSE v_canonical.logo_url END,
    logo_source = CASE WHEN v_logo_source = 'duplicate' THEN v_duplicate.logo_source ELSE v_canonical.logo_source END,
    logo_status = CASE WHEN v_logo_source = 'duplicate' THEN v_duplicate.logo_status ELSE v_canonical.logo_status END,
    logo_fetched_at = CASE WHEN v_logo_source = 'duplicate' THEN v_duplicate.logo_fetched_at ELSE v_canonical.logo_fetched_at END,
    logo_fetch_error = CASE WHEN v_logo_source = 'duplicate' THEN v_duplicate.logo_fetch_error ELSE v_canonical.logo_fetch_error END,
    aliases = v_final_aliases,
    city_id = v_city_id
  WHERE id = p_canonical_company_id;

  IF v_loser_slug IS NOT NULL AND v_loser_slug <> '' AND v_loser_slug IS DISTINCT FROM v_winner_slug THEN
    INSERT INTO public.company_slug_redirects (slug, company_id, source)
    VALUES (v_loser_slug, p_canonical_company_id, 'merge')
    ON CONFLICT (slug) DO UPDATE
      SET company_id = EXCLUDED.company_id,
          source = EXCLUDED.source;

    v_slug_redirects := v_slug_redirects || jsonb_build_array(
      jsonb_build_object('slug', v_loser_slug, 'company_id', p_canonical_company_id)
    );
    v_slug_redirects_created := v_slug_redirects_created + 1;
  END IF;

  -- Company Identity: validate website/primary assertions + move company_domains
  -- before tombstone so the duplicate retains no verified identities.
  v_winner_website := public._company_merge_pick_text_field(
    v_canonical.website,
    v_duplicate.website,
    CASE
      WHEN v_field_resolutions ->> 'website' = 'duplicate' THEN 'duplicate'
      WHEN v_field_resolutions ->> 'website' = 'non_empty' THEN 'non_empty'
      ELSE 'canonical'
    END
  );

  PERFORM public._company_merge_assert_identity_assertions(
    v_winner_domain,
    v_winner_website,
    v_resolutions -> 'identity_assertions'
  );

  PERFORM public._company_merge_assert_no_third_party_domain_owners(
    p_canonical_company_id,
    p_duplicate_company_id,
    v_winner_domain
  );

  v_domains_reconcile := public._company_merge_reconcile_company_domains(
    p_canonical_company_id,
    p_duplicate_company_id,
    v_winner_domain
  );

  UPDATE public.companies
  SET
    name = trim(v_duplicate.name) || ' (merged)',
    slug = v_tombstone_slug,
    domain = NULL,
    website = NULL,
    aliases = '{}'::text[],
    status = 'merged'::public.company_status,
    merged_into_company_id = p_canonical_company_id,
    merged_at = now(),
    merged_by = p_performed_by
  WHERE id = p_duplicate_company_id;

  v_execution := jsonb_build_object(
    'schema_version', 2,
    'phase', 2,
    'completed_at', now(),
    'actions', jsonb_build_object(
      'soft_archived_duplicate', true,
      'event_sponsors_repointed', v_event_sponsors_repointed,
      'event_sponsors_deleted', v_event_sponsors_deleted,
      'event_sponsors_updated', v_event_sponsors_updated,
      'import_rows_proposed_repointed', v_import_rows_proposed_repointed,
      'import_rows_resolved_repointed', v_import_rows_resolved_repointed,
      'draft_links_repointed', v_draft_links_repointed,
      'draft_links_deleted', v_draft_links_deleted,
      'aliases_merged', true,
      'field_resolutions_applied', true,
      'slug_redirects_created', v_slug_redirects_created,
      'event_edition_organizers_repointed', COALESCE((v_organizer_result ->> 'repointed')::integer, 0),
      'event_edition_organizers_deleted', COALESCE((v_organizer_result ->> 'deleted')::integer, 0),
      'event_edition_organizers_updated', COALESCE((v_organizer_result ->> 'updated')::integer, 0),
      'partner_alumni_version_members_repointed', COALESCE((v_partner_alumni_result ->> 'repointed')::integer, 0),
      'partner_alumni_version_members_deleted', COALESCE((v_partner_alumni_result ->> 'deleted')::integer, 0),
      'partner_alumni_version_members_updated', COALESCE((v_partner_alumni_result ->> 'updated')::integer, 0),
      'company_domains_moved', COALESCE((v_domains_reconcile ->> 'moved')::integer, 0),
      'company_domains_deleted_overlap', COALESCE((v_domains_reconcile ->> 'deleted_overlap')::integer, 0),
      'company_domains_primary_synced', COALESCE((v_domains_reconcile ->> 'primary_synced')::boolean, false)
    ),
    'repoint_map', jsonb_build_object(
      'event_sponsors', v_repointed_sponsors,
      'event_sponsors_deleted', v_deleted_sponsors,
      'event_sponsors_updated', v_updated_sponsors,
      'import_rows_proposed', v_import_rows_proposed,
      'import_rows_resolved', v_import_rows_resolved,
      'draft_links_repointed', v_draft_links_repointed_log,
      'draft_links_deleted', v_draft_links_deleted_log,
      'event_edition_organizers', COALESCE(v_organizer_result -> 'repointed_log', '[]'::jsonb),
      'event_edition_organizers_deleted', COALESCE(v_organizer_result -> 'deleted_log', '[]'::jsonb),
      'event_edition_organizers_updated', COALESCE(v_organizer_result -> 'updated_log', '[]'::jsonb),
      'event_edition_organizers_affected_edition_ids', COALESCE(v_organizer_result -> 'affected_edition_ids', '[]'::jsonb),
      'partner_alumni_version_members', COALESCE(v_partner_alumni_result -> 'repointed_log', '[]'::jsonb),
      'partner_alumni_version_members_deleted', COALESCE(v_partner_alumni_result -> 'deleted_log', '[]'::jsonb),
      'partner_alumni_version_members_updated', COALESCE(v_partner_alumni_result -> 'updated_log', '[]'::jsonb)
    ),
    'canonical_patch', jsonb_build_object(
      'before', v_canonical_before,
      'after', public._company_merge_company_row_json(p_canonical_company_id)
    ),
    'duplicate_archive', jsonb_build_object(
      'before', v_duplicate_before,
      'tombstone', jsonb_build_object(
        'name', trim(v_duplicate.name) || ' (merged)',
        'slug', v_tombstone_slug,
        'domain', NULL,
        'website', NULL,
        'aliases', '[]'::jsonb
      ),
      'merged_into_company_id', p_canonical_company_id
    ),
    'slug_redirects', v_slug_redirects,
    'alias_merge', v_alias_merge,
    'resolutions_applied', v_resolutions
  );

  INSERT INTO public.company_merges (
    canonical_company_id,
    duplicate_company_id,
    performed_by,
    status,
    preview_snapshot,
    execution_snapshot,
    field_resolutions,
    notes
  )
  VALUES (
    p_canonical_company_id,
    p_duplicate_company_id,
    p_performed_by,
    'completed'::public.company_merge_status,
    v_preview,
    v_execution,
    v_field_resolutions,
    p_notes
  )
  RETURNING id INTO v_merge_id;

  UPDATE public.company_slug_redirects
  SET company_merge_id = v_merge_id
  WHERE company_id = p_canonical_company_id
    AND company_merge_id IS NULL
    AND v_slug_redirects_created > 0
    AND slug = v_loser_slug;

  RETURN jsonb_build_object(
    'merge_id', v_merge_id,
    'status', 'completed',
    'canonical_company_id', p_canonical_company_id,
    'duplicate_company_id', p_duplicate_company_id,
    'preview_snapshot', v_preview,
    'execution_snapshot', v_execution
  );
END;
$$;



COMMENT ON FUNCTION public.merge_companies(uuid, uuid, uuid, jsonb, text) IS
  'Execute company merge: repoint deps, reconcile company_domains, soft-archive duplicate.';

REVOKE ALL ON FUNCTION public.merge_companies(uuid, uuid, uuid, jsonb, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.merge_companies(uuid, uuid, uuid, jsonb, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_companies(uuid, uuid, uuid, jsonb, text) TO service_role;
