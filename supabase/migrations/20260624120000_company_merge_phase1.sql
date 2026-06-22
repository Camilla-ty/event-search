-- Phase 1 — Company merge: schema, audit table, preview + guarded execute RPCs.
-- Execute soft-archives duplicates with zero dependencies only; repointing is Phase 2.

-- =============================================================================
-- Enum types
-- =============================================================================

CREATE TYPE public.company_status AS ENUM ('active', 'merged');

CREATE TYPE public.company_merge_status AS ENUM ('completed', 'failed');

-- =============================================================================
-- companies — soft-merge columns
-- =============================================================================

ALTER TABLE public.companies
  ADD COLUMN status public.company_status NOT NULL DEFAULT 'active',
  ADD COLUMN merged_into_company_id uuid REFERENCES public.companies (id) ON DELETE RESTRICT,
  ADD COLUMN merged_at timestamptz,
  ADD COLUMN merged_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL;

ALTER TABLE public.companies
  ADD CONSTRAINT companies_active_not_merged CHECK (
    status = 'merged'::public.company_status
    OR (merged_into_company_id IS NULL AND merged_at IS NULL)
  );

ALTER TABLE public.companies
  ADD CONSTRAINT companies_merged_requires_target CHECK (
    status <> 'merged'::public.company_status
    OR (
      merged_into_company_id IS NOT NULL
      AND merged_at IS NOT NULL
      AND merged_into_company_id <> id
    )
  );

CREATE INDEX companies_merged_into_idx
  ON public.companies (merged_into_company_id)
  WHERE merged_into_company_id IS NOT NULL;

CREATE INDEX companies_status_active_idx
  ON public.companies (status)
  WHERE status = 'active'::public.company_status;

-- =============================================================================
-- company_merges — audit log
-- =============================================================================

CREATE TABLE public.company_merges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE RESTRICT,
  duplicate_company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE RESTRICT,
  performed_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  performed_at timestamptz NOT NULL DEFAULT now(),
  status public.company_merge_status NOT NULL,
  preview_snapshot jsonb NOT NULL,
  execution_snapshot jsonb,
  field_resolutions jsonb,
  notes text,
  error_message text,
  CONSTRAINT company_merges_distinct_companies CHECK (canonical_company_id <> duplicate_company_id)
);

CREATE INDEX company_merges_canonical_idx
  ON public.company_merges (canonical_company_id, performed_at DESC);

CREATE INDEX company_merges_duplicate_idx
  ON public.company_merges (duplicate_company_id, performed_at DESC);

CREATE INDEX company_merges_performed_at_idx
  ON public.company_merges (performed_at DESC);

ALTER TABLE public.company_merges ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.company_merges FROM anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.company_merges TO service_role;

-- =============================================================================
-- Internal helpers
-- =============================================================================

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
    'short_description', c.short_description,
    'description', c.description,
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

REVOKE ALL ON FUNCTION public._company_merge_company_snapshot(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public._company_merge_assert_preconditions(
  p_canonical_company_id uuid,
  p_duplicate_company_id uuid,
  p_require_performed_by boolean DEFAULT false,
  p_performed_by uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_canonical public.companies%ROWTYPE;
  v_duplicate public.companies%ROWTYPE;
  v_cycle_exists boolean;
BEGIN
  IF p_canonical_company_id IS NULL OR p_duplicate_company_id IS NULL THEN
    RAISE EXCEPTION 'merge_invalid_company_id';
  END IF;

  IF p_canonical_company_id = p_duplicate_company_id THEN
    RAISE EXCEPTION 'merge_same_company';
  END IF;

  SELECT * INTO v_canonical
  FROM public.companies
  WHERE id = p_canonical_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'merge_canonical_not_found';
  END IF;

  SELECT * INTO v_duplicate
  FROM public.companies
  WHERE id = p_duplicate_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'merge_duplicate_not_found';
  END IF;

  IF v_canonical.status <> 'active'::public.company_status THEN
    RAISE EXCEPTION 'merge_canonical_not_active';
  END IF;

  IF v_canonical.merged_into_company_id IS NOT NULL THEN
    RAISE EXCEPTION 'merge_canonical_is_merged';
  END IF;

  IF v_duplicate.status <> 'active'::public.company_status THEN
    RAISE EXCEPTION 'merge_duplicate_not_active';
  END IF;

  IF v_duplicate.merged_into_company_id IS NOT NULL THEN
    RAISE EXCEPTION 'merge_duplicate_not_active';
  END IF;

  WITH RECURSIVE chain AS (
    SELECT c.id, c.merged_into_company_id
    FROM public.companies c
    WHERE c.id = p_canonical_company_id
    UNION ALL
    SELECT c.id, c.merged_into_company_id
    FROM public.companies c
    INNER JOIN chain ON c.id = chain.merged_into_company_id
    WHERE chain.merged_into_company_id IS NOT NULL
  )
  SELECT EXISTS (
    SELECT 1
    FROM chain
    WHERE id = p_duplicate_company_id
  )
  INTO v_cycle_exists;

  IF v_cycle_exists THEN
    RAISE EXCEPTION 'merge_would_create_cycle';
  END IF;

  IF p_require_performed_by THEN
    IF p_performed_by IS NULL THEN
      RAISE EXCEPTION 'merge_performed_by_required';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_performed_by) THEN
      RAISE EXCEPTION 'merge_performed_by_not_found';
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public._company_merge_assert_preconditions(uuid, uuid, boolean, uuid) FROM PUBLIC;

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
  v_import_rows_proposed_to_repoint integer;
  v_import_rows_resolved_to_repoint integer;
  v_draft_links_to_repoint integer;
  v_sponsorship_conflicts jsonb;
  v_draft_link_conflicts jsonb;
  v_blockers jsonb := '[]'::jsonb;
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
        'batch_id', dl_dup.batch_id,
        'event_edition_id', dl_dup.event_edition_id,
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

  IF
    v_event_sponsors_to_repoint > 0
    OR v_import_rows_proposed_to_repoint > 0
    OR v_import_rows_resolved_to_repoint > 0
    OR v_draft_links_to_repoint > 0
  THEN
    v_blockers := v_blockers || jsonb_build_array('merge_dependencies_not_repointed');
  END IF;

  IF (v_canonical ->> 'domain') IS DISTINCT FROM (v_duplicate ->> 'domain') THEN
    v_warnings := v_warnings || jsonb_build_array('duplicate_has_different_domain');
  END IF;

  IF (v_canonical ->> 'slug') IS DISTINCT FROM (v_duplicate ->> 'slug') THEN
    v_warnings := v_warnings || jsonb_build_array('duplicate_slug_will_need_redirect');
  END IF;

  v_executable :=
    v_event_sponsors_to_repoint = 0
    AND v_import_rows_proposed_to_repoint = 0
    AND v_import_rows_resolved_to_repoint = 0
    AND v_draft_links_to_repoint = 0;

  RETURN jsonb_build_object(
    'schema_version', 1,
    'generated_at', now(),
    'canonical_company_id', p_canonical_company_id,
    'duplicate_company_id', p_duplicate_company_id,
    'companies', jsonb_build_object(
      'canonical', v_canonical,
      'duplicate', v_duplicate
    ),
    'impact', jsonb_build_object(
      'event_sponsors_to_repoint', v_event_sponsors_to_repoint,
      'import_rows_proposed_to_repoint', v_import_rows_proposed_to_repoint,
      'import_rows_resolved_to_repoint', v_import_rows_resolved_to_repoint,
      'draft_links_to_repoint', v_draft_links_to_repoint
    ),
    'sponsorship_conflicts', v_sponsorship_conflicts,
    'draft_link_conflicts', v_draft_link_conflicts,
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
      'short_description', jsonb_build_object(
        'canonical', v_canonical -> 'short_description',
        'duplicate', v_duplicate -> 'short_description'
      ),
      'description', jsonb_build_object(
        'canonical', v_canonical -> 'description',
        'duplicate', v_duplicate -> 'description'
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
    'executable_in_phase', v_executable
  );
END;
$$;

REVOKE ALL ON FUNCTION public._company_merge_build_preview(uuid, uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public._company_merge_duplicate_has_dependencies(
  p_duplicate_company_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.event_sponsors es
    WHERE es.company_id = p_duplicate_company_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.sponsor_import_rows sir
    WHERE sir.proposed_company_id = p_duplicate_company_id
       OR sir.resolved_company_id = p_duplicate_company_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.sponsor_import_draft_links sdl
    WHERE sdl.company_id = p_duplicate_company_id
  );
$$;

REVOKE ALL ON FUNCTION public._company_merge_duplicate_has_dependencies(uuid) FROM PUBLIC;

-- =============================================================================
-- company_merge_preview — read-only
-- =============================================================================

CREATE OR REPLACE FUNCTION public.company_merge_preview(
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
  v_preview jsonb;
BEGIN
  PERFORM public._company_merge_assert_preconditions(
    p_canonical_company_id,
    p_duplicate_company_id,
    false,
    NULL
  );

  v_preview := public._company_merge_build_preview(
    p_canonical_company_id,
    p_duplicate_company_id
  );

  RETURN jsonb_build_object('preview_snapshot', v_preview);
END;
$$;

REVOKE ALL ON FUNCTION public.company_merge_preview(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.company_merge_preview(uuid, uuid) TO service_role;

-- =============================================================================
-- merge_companies — guarded execute (Phase 1: soft archive only)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.merge_companies(
  p_canonical_company_id uuid,
  p_duplicate_company_id uuid,
  p_performed_by uuid,
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
  v_preview jsonb;
  v_execution jsonb;
  v_merge_id uuid;
BEGIN
  PERFORM public._company_merge_assert_preconditions(
    p_canonical_company_id,
    p_duplicate_company_id,
    true,
    p_performed_by
  );

  -- Lock in UUID order to avoid deadlocks when merging concurrently.
  IF p_canonical_company_id < p_duplicate_company_id THEN
    PERFORM 1
    FROM public.companies
    WHERE id = p_canonical_company_id
    FOR UPDATE;

    PERFORM 1
    FROM public.companies
    WHERE id = p_duplicate_company_id
    FOR UPDATE;
  ELSE
    PERFORM 1
    FROM public.companies
    WHERE id = p_duplicate_company_id
    FOR UPDATE;

    PERFORM 1
    FROM public.companies
    WHERE id = p_canonical_company_id
    FOR UPDATE;
  END IF;

  SELECT * INTO v_canonical
  FROM public.companies
  WHERE id = p_canonical_company_id;

  SELECT * INTO v_duplicate
  FROM public.companies
  WHERE id = p_duplicate_company_id;

  v_preview := public._company_merge_build_preview(
    p_canonical_company_id,
    p_duplicate_company_id
  );

  IF public._company_merge_duplicate_has_dependencies(p_duplicate_company_id) THEN
    RAISE EXCEPTION 'merge_dependencies_not_repointed';
  END IF;

  UPDATE public.companies
  SET
    status = 'merged'::public.company_status,
    merged_into_company_id = p_canonical_company_id,
    merged_at = now(),
    merged_by = p_performed_by
  WHERE id = p_duplicate_company_id;

  v_execution := jsonb_build_object(
    'schema_version', 1,
    'phase', 1,
    'completed_at', now(),
    'actions', jsonb_build_object(
      'soft_archived_duplicate', true,
      'event_sponsors_repointed', 0,
      'import_rows_repointed', 0,
      'draft_links_repointed', 0,
      'aliases_merged', false,
      'field_resolutions_applied', false
    ),
    'repoint_deferred', true
  );

  INSERT INTO public.company_merges (
    canonical_company_id,
    duplicate_company_id,
    performed_by,
    status,
    preview_snapshot,
    execution_snapshot,
    notes
  )
  VALUES (
    p_canonical_company_id,
    p_duplicate_company_id,
    p_performed_by,
    'completed'::public.company_merge_status,
    v_preview,
    v_execution,
    p_notes
  )
  RETURNING id INTO v_merge_id;

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

REVOKE ALL ON FUNCTION public.merge_companies(uuid, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_companies(uuid, uuid, uuid, text) TO service_role;
