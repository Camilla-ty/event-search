-- Remove companies.short_description / companies.description from dependent functions
-- before the columns are dropped.

CREATE OR REPLACE FUNCTION public._company_merge_company_snapshot(p_company_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', c.id,
    'name', c.name,
    'slug', c.slug,
    'domain', c.domain,
    'website', c.website,
    'logo_url', c.logo_url,
    'logo_source', c.logo_source,
    'logo_status', c.logo_status,
    'city_id', c.city_id,
    'aliases', COALESCE(to_jsonb(c.aliases), '[]'::jsonb),
    'created_at', c.created_at,
    'status', c.status,
    'merged_into_company_id', c.merged_into_company_id,
    'sponsor_link_count', (
      SELECT COUNT(*)::integer
      FROM public.event_sponsors es
      WHERE es.company_id = c.id
    )
  )
  FROM public.companies c
  WHERE c.id = p_company_id;
$$;


COMMENT ON FUNCTION public._company_merge_company_snapshot(uuid) IS
  'JSON snapshot of a company for merge preview/execute (no description fields).';

REVOKE ALL ON FUNCTION public._company_merge_company_snapshot(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._company_merge_company_snapshot(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public._company_merge_company_snapshot(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public._company_merge_default_field_resolutions()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'slug', 'canonical',
    'domain', 'canonical',
    'website', 'canonical',
    'logo', 'best_available'
  );
$$;


COMMENT ON FUNCTION public._company_merge_default_field_resolutions() IS
  'Default merge field_resolutions (slug/domain/website/logo only).';

REVOKE ALL ON FUNCTION public._company_merge_default_field_resolutions() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._company_merge_default_field_resolutions() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public._company_merge_default_field_resolutions() TO service_role;

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

  v_executable :=
    jsonb_array_length(v_required_sponsorship) = 0
    AND jsonb_array_length(v_required_organizer) = 0
    AND jsonb_array_length(v_required_draft) = 0;

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
    'blockers', '[]'::jsonb,
    'warnings', v_warnings,
    'executable', v_executable,
    'executable_in_phase', v_executable
  );
END;
$$;


COMMENT ON FUNCTION public._company_merge_build_preview(uuid, uuid) IS
  'Read-only company merge preview snapshot.';

REVOKE ALL ON FUNCTION public._company_merge_build_preview(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._company_merge_build_preview(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public._company_merge_build_preview(uuid, uuid) TO service_role;

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
      'partner_alumni_version_members_updated', COALESCE((v_partner_alumni_result ->> 'updated')::integer, 0)
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
  'Execute company merge: repoint deps, apply field resolutions, soft-archive duplicate.';

REVOKE ALL ON FUNCTION public.merge_companies(uuid, uuid, uuid, jsonb, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.merge_companies(uuid, uuid, uuid, jsonb, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_companies(uuid, uuid, uuid, jsonb, text) TO service_role;

CREATE OR REPLACE FUNCTION public.sponsor_discovery_page(
  p_query text DEFAULT NULL,
  p_event_slug text DEFAULT NULL,
  p_sort text DEFAULT 'activity',
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 20
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH params AS (
    SELECT
      nullif(trim(coalesce(p_query, '')), '') AS query_term,
      nullif(trim(coalesce(p_event_slug, '')), '') AS event_slug,
      CASE
        WHEN nullif(trim(coalesce(p_sort, '')), '') IS NULL THEN 'activity'
        WHEN lower(trim(p_sort)) NOT IN ('activity', 'name', 'count', 'tier') THEN 'activity'
        ELSE lower(trim(p_sort))
      END AS raw_sort,
      greatest(coalesce(p_page, 1), 1) AS page,
      least(greatest(coalesce(p_page_size, 20), 1), 50) AS page_size
  ),
  resolved_event AS (
    SELECT ee.id, ee.slug, ee.name
    FROM params p
    INNER JOIN public.event_editions ee ON ee.slug = p.event_slug
    WHERE p.event_slug IS NOT NULL
  ),
  params2 AS (
    SELECT
      p.query_term,
      p.event_slug,
      p.page,
      p.page_size,
      (
        p.event_slug IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM resolved_event)
      ) AS event_unknown,
      CASE
        WHEN p.event_slug IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM resolved_event) THEN 'activity'
        WHEN p.raw_sort = 'tier' AND p.event_slug IS NULL THEN 'activity'
        ELSE p.raw_sort
      END AS effective_sort
    FROM params p
  ),
  global_eligible AS (
    SELECT
      c.id,
      c.name,
      c.slug,
      c.domain,
      c.website,
      c.logo_url,
      c.logo_source,
      c.logo_status,
      css.sponsored_edition_count,
      css.latest_activity_at,
      NULL::integer AS tier_rank,
      NULL::text AS tier_label
    FROM public.company_sponsor_stats css
    INNER JOIN public.companies c ON c.id = css.company_id
    CROSS JOIN params2 p
    WHERE p.event_slug IS NULL
      AND NOT p.event_unknown
      AND c.restricted_at IS NULL
      AND (
        p.query_term IS NULL
        OR c.name ILIKE '%' || p.query_term || '%'
        OR c.slug ILIKE '%' || p.query_term || '%'
        OR coalesce(c.domain, '') ILIKE '%' || p.query_term || '%'
        OR coalesce(c.website, '') ILIKE '%' || p.query_term || '%'
        OR EXISTS (
          SELECT 1
          FROM unnest(coalesce(c.aliases, '{}'::text[])) AS a(alias)
          WHERE a.alias ILIKE '%' || p.query_term || '%'
        )
        OR public.__company_matches_verified_domain_search(c.id, p.query_term)
      )
  ),
  visible_links AS (
    SELECT
      es.company_id,
      es.event_editions_id,
      es.tier_rank,
      es.tier_label,
      ee.start_date,
      ee.slug AS edition_slug
    FROM public.event_sponsors es
    INNER JOIN public.event_editions ee ON ee.id = es.event_editions_id
  ),
  filtered_links AS (
    SELECT vl.*
    FROM visible_links vl
    CROSS JOIN params2 p
    WHERE p.event_slug IS NOT NULL
      AND NOT p.event_unknown
      AND vl.edition_slug = p.event_slug
  ),
  event_company_stats AS (
    SELECT
      fl.company_id,
      count(DISTINCT fl.event_editions_id)::integer AS sponsored_edition_count,
      max(fl.start_date) AS latest_activity_at
    FROM filtered_links fl
    GROUP BY fl.company_id
  ),
  event_context AS (
    SELECT DISTINCT ON (fl.company_id)
      fl.company_id,
      fl.tier_rank,
      fl.tier_label
    FROM filtered_links fl
    ORDER BY
      fl.company_id,
      fl.tier_rank ASC NULLS LAST,
      fl.tier_label ASC NULLS LAST
  ),
  event_eligible AS (
    SELECT
      c.id,
      c.name,
      c.slug,
      c.domain,
      c.website,
      c.logo_url,
      c.logo_source,
      c.logo_status,
      ecs.sponsored_edition_count,
      ecs.latest_activity_at,
      ec.tier_rank,
      ec.tier_label
    FROM event_company_stats ecs
    INNER JOIN public.companies c ON c.id = ecs.company_id
    LEFT JOIN event_context ec ON ec.company_id = c.id
    CROSS JOIN params2 p
    WHERE p.event_slug IS NOT NULL
      AND NOT p.event_unknown
      AND c.restricted_at IS NULL
      AND (
        p.query_term IS NULL
        OR c.name ILIKE '%' || p.query_term || '%'
        OR c.slug ILIKE '%' || p.query_term || '%'
        OR coalesce(c.domain, '') ILIKE '%' || p.query_term || '%'
        OR coalesce(c.website, '') ILIKE '%' || p.query_term || '%'
        OR EXISTS (
          SELECT 1
          FROM unnest(coalesce(c.aliases, '{}'::text[])) AS a(alias)
          WHERE a.alias ILIKE '%' || p.query_term || '%'
        )
        OR public.__company_matches_verified_domain_search(c.id, p.query_term)
      )
  ),
  eligible AS (
    SELECT * FROM global_eligible
    UNION ALL
    SELECT * FROM event_eligible
  ),
  total_count AS (
    SELECT count(*)::integer AS total
    FROM eligible
  ),
  paged AS (
    SELECT e.*
    FROM eligible e
    CROSS JOIN params2 p
    ORDER BY
      CASE WHEN p.effective_sort = 'activity' THEN e.latest_activity_at END DESC NULLS LAST,
      CASE WHEN p.effective_sort = 'count' THEN e.sponsored_edition_count END DESC NULLS LAST,
      CASE WHEN p.effective_sort = 'tier' THEN e.tier_rank END ASC NULLS LAST,
      CASE WHEN p.effective_sort = 'tier' THEN e.tier_label END ASC NULLS LAST,
      CASE WHEN p.effective_sort = 'name' THEN e.name END ASC NULLS LAST,
      e.name ASC,
      e.id ASC
    OFFSET (SELECT greatest((p2.page - 1) * p2.page_size, 0) FROM params2 p2)
    LIMIT (SELECT p2.page_size FROM params2 p2)
  ),
  rows_json AS (
    SELECT coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', pg.id,
          'name', pg.name,
          'slug', pg.slug,
          'domain', pg.domain,
          'website', pg.website,
          'logo_url', pg.logo_url,
          'logo_source', pg.logo_source,
          'logo_status', pg.logo_status,
          'sponsored_edition_count', pg.sponsored_edition_count,
          'latest_activity_at', pg.latest_activity_at,
          'event_tier_label', CASE
            WHEN (SELECT p2.event_slug FROM params2 p2) IS NOT NULL
              AND NOT (SELECT p2.event_unknown FROM params2 p2)
            THEN nullif(trim(coalesce(pg.tier_label, '')), '')
            ELSE NULL
          END
        )
        ORDER BY
          CASE WHEN (SELECT effective_sort FROM params2) = 'activity' THEN pg.latest_activity_at END DESC NULLS LAST,
          CASE WHEN (SELECT effective_sort FROM params2) = 'count' THEN pg.sponsored_edition_count END DESC NULLS LAST,
          CASE WHEN (SELECT effective_sort FROM params2) = 'tier' THEN pg.tier_rank END ASC NULLS LAST,
          CASE WHEN (SELECT effective_sort FROM params2) = 'tier' THEN pg.tier_label END ASC NULLS LAST,
          CASE WHEN (SELECT effective_sort FROM params2) = 'name' THEN pg.name END ASC NULLS LAST,
          pg.name ASC,
          pg.id ASC
      ),
      '[]'::jsonb
    ) AS rows
    FROM paged pg
  )
  SELECT jsonb_build_object(
    'rows', (SELECT rows FROM rows_json),
    'total', (SELECT total FROM total_count),
    'page', (SELECT page FROM params2),
    'page_size', (SELECT page_size FROM params2),
    'sort', (SELECT effective_sort FROM params2),
    'event_unknown', (SELECT event_unknown FROM params2),
    'event',
      CASE
        WHEN (SELECT event_slug FROM params2) IS NULL THEN NULL
        WHEN (SELECT event_unknown FROM params2) THEN jsonb_build_object(
          'slug', (SELECT event_slug FROM params2)
        )
        ELSE (
          SELECT jsonb_build_object(
            'slug', re.slug,
            'name', re.name
          )
          FROM resolved_event re
        )
      END
  );
$$;


COMMENT ON FUNCTION public.sponsor_discovery_page(text, text, text, integer, integer) IS
  'Sponsor discovery: searches companies.domain, website, aliases, and verified company_domains rows. '
  'Public JSON excludes short_description, tier_rank, tier_label, and event.id. SECURITY INVOKER.';

REVOKE ALL ON FUNCTION public.sponsor_discovery_page(text, text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sponsor_discovery_page(text, text, text, integer, integer) TO anon, authenticated;
