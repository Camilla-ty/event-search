-- Phase 2 — Company merge: repointing, conflict resolution, identity merge, full audit.

-- =============================================================================
-- company_slug_redirects
-- =============================================================================

CREATE TABLE public.company_slug_redirects (
  slug text PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'merge',
  company_merge_id uuid REFERENCES public.company_merges (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX company_slug_redirects_company_id_idx
  ON public.company_slug_redirects (company_id);

ALTER TABLE public.company_slug_redirects ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.company_slug_redirects FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.company_slug_redirects TO service_role;

-- =============================================================================
-- Internal helpers (Phase 2)
-- =============================================================================

CREATE OR REPLACE FUNCTION public._company_merge_name_key(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(trim(COALESCE(p_value, '')));
$$;

REVOKE ALL ON FUNCTION public._company_merge_name_key(text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public._company_merge_company_row_json(p_company_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_jsonb(c)
  FROM public.companies c
  WHERE c.id = p_company_id;
$$;

REVOKE ALL ON FUNCTION public._company_merge_company_row_json(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public._company_merge_default_field_resolutions()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'slug', 'canonical',
    'domain', 'canonical',
    'website', 'canonical',
    'logo', 'best_available',
    'short_description', 'longer',
    'description', 'longer'
  );
$$;

REVOKE ALL ON FUNCTION public._company_merge_default_field_resolutions() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public._company_merge_logo_score(
  p_logo_url text,
  p_logo_source text,
  p_logo_status text
)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_score integer := 0;
BEGIN
  IF p_logo_url IS NOT NULL AND trim(p_logo_url) <> '' THEN
    v_score := v_score + 10;
  END IF;

  IF p_logo_status = 'ok' THEN
    v_score := v_score + 100;
  ELSIF p_logo_status IS NOT NULL AND p_logo_status <> '' THEN
    v_score := v_score + 20;
  END IF;

  IF p_logo_source = 'manual' THEN
    v_score := v_score + 50;
  ELSIF p_logo_source = 'logo_dev' THEN
    v_score := v_score + 30;
  END IF;

  RETURN v_score;
END;
$$;

REVOKE ALL ON FUNCTION public._company_merge_logo_score(text, text, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public._company_merge_pick_text_field(
  p_canonical text,
  p_duplicate text,
  p_strategy text
)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_canonical text := NULLIF(trim(COALESCE(p_canonical, '')), '');
  v_duplicate text := NULLIF(trim(COALESCE(p_duplicate, '')), '');
BEGIN
  IF p_strategy = 'duplicate' THEN
    RETURN COALESCE(v_duplicate, v_canonical);
  ELSIF p_strategy = 'non_empty' THEN
    RETURN COALESCE(v_canonical, v_duplicate);
  ELSIF p_strategy = 'longer' THEN
    IF v_duplicate IS NULL THEN
      RETURN v_canonical;
    ELSIF v_canonical IS NULL THEN
      RETURN v_duplicate;
    ELSIF length(v_duplicate) > length(v_canonical) THEN
      RETURN v_duplicate;
    END IF;
    RETURN v_canonical;
  END IF;

  RETURN COALESCE(v_canonical, v_duplicate);
END;
$$;

REVOKE ALL ON FUNCTION public._company_merge_pick_text_field(text, text, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public._company_merge_merge_aliases(
  p_canonical_name text,
  p_canonical_aliases text[],
  p_duplicate_name text,
  p_duplicate_aliases text[]
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_canonical_key text := public._company_merge_name_key(p_canonical_name);
  v_result text[] := ARRAY[]::text[];
  v_seen text[] := ARRAY[]::text[];
  v_added text[] := ARRAY[]::text[];
  v_dropped text[] := ARRAY[]::text[];
  v_candidate text;
  v_key text;
  v_alias text;
  v_max_aliases constant integer := 20;
  v_max_length constant integer := 120;
BEGIN
  FOREACH v_alias IN ARRAY COALESCE(p_canonical_aliases, ARRAY[]::text[])
  LOOP
    v_candidate := trim(v_alias);
    IF v_candidate = '' OR length(v_candidate) > v_max_length THEN
      CONTINUE;
    END IF;
    v_key := public._company_merge_name_key(v_candidate);
    IF v_key = '' OR v_key = v_canonical_key OR v_key = ANY(v_seen) THEN
      CONTINUE;
    END IF;
    v_result := array_append(v_result, v_candidate);
    v_seen := array_append(v_seen, v_key);
  END LOOP;

  v_candidate := trim(COALESCE(p_duplicate_name, ''));
  IF v_candidate <> '' AND length(v_candidate) <= v_max_length THEN
    v_key := public._company_merge_name_key(v_candidate);
    IF v_key <> '' AND v_key <> v_canonical_key AND NOT (v_key = ANY(v_seen)) THEN
      v_result := array_append(v_result, v_candidate);
      v_seen := array_append(v_seen, v_key);
      v_added := array_append(v_added, v_candidate);
    END IF;
  END IF;

  FOREACH v_alias IN ARRAY COALESCE(p_duplicate_aliases, ARRAY[]::text[])
  LOOP
    v_candidate := trim(v_alias);
    IF v_candidate = '' OR length(v_candidate) > v_max_length THEN
      CONTINUE;
    END IF;
    v_key := public._company_merge_name_key(v_candidate);
    IF v_key = '' OR v_key = v_canonical_key OR v_key = ANY(v_seen) THEN
      CONTINUE;
    END IF;
    IF array_length(v_result, 1) IS NOT NULL AND array_length(v_result, 1) >= v_max_aliases THEN
      v_dropped := array_append(v_dropped, v_candidate);
      CONTINUE;
    END IF;
    v_result := array_append(v_result, v_candidate);
    v_seen := array_append(v_seen, v_key);
    v_added := array_append(v_added, v_candidate);
  END LOOP;

  RETURN jsonb_build_object(
    'aliases', to_jsonb(v_result),
    'added', to_jsonb(v_added),
    'dropped', to_jsonb(v_dropped)
  );
END;
$$;

REVOKE ALL ON FUNCTION public._company_merge_merge_aliases(text, text[], text, text[]) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public._company_merge_sponsorship_strategy(
  p_resolutions jsonb,
  p_event_edition_id uuid
)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_item jsonb;
  v_strategy text;
BEGIN
  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(COALESCE(p_resolutions -> 'sponsorship_conflicts', '[]'::jsonb))
  LOOP
    IF (v_item ->> 'event_edition_id')::uuid = p_event_edition_id THEN
      v_strategy := v_item ->> 'strategy';
      IF v_strategy IN ('keep_canonical', 'keep_duplicate_tier') THEN
        RETURN v_strategy;
      END IF;
      RAISE EXCEPTION 'merge_invalid_resolution';
    END IF;
  END LOOP;

  RAISE EXCEPTION 'merge_missing_resolution';
END;
$$;

REVOKE ALL ON FUNCTION public._company_merge_sponsorship_strategy(jsonb, uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public._company_merge_draft_link_strategy(
  p_resolutions jsonb,
  p_batch_id uuid
)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_item jsonb;
  v_strategy text;
BEGIN
  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(COALESCE(p_resolutions -> 'draft_link_conflicts', '[]'::jsonb))
  LOOP
    IF (v_item ->> 'batch_id')::uuid = p_batch_id THEN
      v_strategy := v_item ->> 'strategy';
      IF v_strategy IN ('keep_canonical_draft', 'keep_duplicate_draft') THEN
        RETURN v_strategy;
      END IF;
      RAISE EXCEPTION 'merge_invalid_resolution';
    END IF;
  END LOOP;

  RAISE EXCEPTION 'merge_missing_resolution';
END;
$$;

REVOKE ALL ON FUNCTION public._company_merge_draft_link_strategy(jsonb, uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public._company_merge_validate_resolutions(
  p_preview jsonb,
  p_resolutions jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_normalized jsonb;
  v_required_sponsorship jsonb;
  v_required_draft jsonb;
  v_item jsonb;
  v_edition_id uuid;
  v_batch_id uuid;
BEGIN
  v_normalized := COALESCE(p_resolutions, '{}'::jsonb);

  IF v_normalized = '{}'::jsonb THEN
    v_normalized := jsonb_build_object(
      'schema_version', 2,
      'sponsorship_conflicts', '[]'::jsonb,
      'draft_link_conflicts', '[]'::jsonb,
      'field_resolutions', public._company_merge_default_field_resolutions()
    );
  END IF;

  IF COALESCE(v_normalized -> 'field_resolutions', 'null'::jsonb) = 'null'::jsonb THEN
    v_normalized := jsonb_set(
      v_normalized,
      '{field_resolutions}',
      public._company_merge_default_field_resolutions(),
      true
    );
  END IF;

  v_required_sponsorship := COALESCE(
    p_preview -> 'required_resolutions' -> 'sponsorship_conflicts',
    '[]'::jsonb
  );

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_required_sponsorship)
  LOOP
    v_edition_id := (v_item #>> '{}')::uuid;
    PERFORM public._company_merge_sponsorship_strategy(v_normalized, v_edition_id);
  END LOOP;

  v_required_draft := COALESCE(
    p_preview -> 'required_resolutions' -> 'draft_link_conflicts',
    '[]'::jsonb
  );

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_required_draft)
  LOOP
    v_batch_id := (v_item #>> '{}')::uuid;
    PERFORM public._company_merge_draft_link_strategy(v_normalized, v_batch_id);
  END LOOP;

  RETURN v_normalized;
END;
$$;

REVOKE ALL ON FUNCTION public._company_merge_validate_resolutions(jsonb, jsonb) FROM PUBLIC;

-- =============================================================================
-- Preview builder (schema_version 2)
-- =============================================================================

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
  v_required_sponsorship jsonb;
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
      'import_rows_proposed_to_repoint', v_import_rows_proposed_to_repoint,
      'import_rows_resolved_to_repoint', v_import_rows_resolved_to_repoint,
      'draft_links_to_repoint', v_draft_links_to_repoint
    ),
    'sponsorship_conflicts', v_sponsorship_conflicts,
    'draft_link_conflicts', v_draft_link_conflicts,
    'required_resolutions', jsonb_build_object(
      'sponsorship_conflicts', v_required_sponsorship,
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
    'blockers', '[]'::jsonb,
    'warnings', v_warnings,
    'executable', v_executable,
    'executable_in_phase', v_executable
  );
END;
$$;

-- =============================================================================
-- merge_companies — Phase 2 execute
-- =============================================================================

DROP FUNCTION IF EXISTS public.merge_companies(uuid, uuid, uuid, text);

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
  v_canonical_logo_score integer;
  v_duplicate_logo_score integer;
  v_logo_source text;
  v_city_id uuid;
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
    domain = public._company_merge_pick_text_field(
      v_canonical.domain,
      v_duplicate.domain,
      CASE
        WHEN v_field_resolutions ->> 'domain' = 'duplicate' THEN 'duplicate'
        WHEN v_field_resolutions ->> 'domain' = 'non_empty' THEN 'non_empty'
        ELSE 'canonical'
      END
    ),
    website = public._company_merge_pick_text_field(
      v_canonical.website,
      v_duplicate.website,
      CASE
        WHEN v_field_resolutions ->> 'website' = 'duplicate' THEN 'duplicate'
        WHEN v_field_resolutions ->> 'website' = 'non_empty' THEN 'non_empty'
        ELSE 'canonical'
      END
    ),
    short_description = public._company_merge_pick_text_field(
      v_canonical.short_description,
      v_duplicate.short_description,
      COALESCE(v_field_resolutions ->> 'short_description', 'longer')
    ),
    description = public._company_merge_pick_text_field(
      v_canonical.description,
      v_duplicate.description,
      COALESCE(v_field_resolutions ->> 'description', 'longer')
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
    slug = 'merged-' || left(replace(p_duplicate_company_id::text, '-', ''), 8),
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
      'slug_redirects_created', v_slug_redirects_created
    ),
    'repoint_map', jsonb_build_object(
      'event_sponsors', v_repointed_sponsors,
      'event_sponsors_deleted', v_deleted_sponsors,
      'event_sponsors_updated', v_updated_sponsors,
      'import_rows_proposed', v_import_rows_proposed,
      'import_rows_resolved', v_import_rows_resolved,
      'draft_links_repointed', v_draft_links_repointed_log,
      'draft_links_deleted', v_draft_links_deleted_log
    ),
    'canonical_patch', jsonb_build_object(
      'before', v_canonical_before,
      'after', public._company_merge_company_row_json(p_canonical_company_id)
    ),
    'duplicate_archive', jsonb_build_object(
      'before', v_duplicate_before,
      'tombstone', jsonb_build_object(
        'name', trim(v_duplicate.name) || ' (merged)',
        'slug', 'merged-' || left(replace(p_duplicate_company_id::text, '-', ''), 8),
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

REVOKE ALL ON FUNCTION public.merge_companies(uuid, uuid, uuid, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_companies(uuid, uuid, uuid, jsonb, text) TO service_role;
