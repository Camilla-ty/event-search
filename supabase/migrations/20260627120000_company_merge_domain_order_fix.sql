-- Fix merge_companies domain order: release duplicate domain before canonical claims it.

CREATE OR REPLACE FUNCTION public._company_merge_tombstone_slug(p_company_id uuid)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 'merged-' || left(replace(p_company_id::text, '-', ''), 8);
$$;

REVOKE ALL ON FUNCTION public._company_merge_tombstone_slug(uuid) FROM PUBLIC;

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

REVOKE ALL ON FUNCTION public.merge_companies(uuid, uuid, uuid, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_companies(uuid, uuid, uuid, jsonb, text) TO service_role;
