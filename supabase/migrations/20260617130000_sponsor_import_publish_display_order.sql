-- Imports append, never reorder: new sponsors land at the end of their tier
-- (in spreadsheet order), tier-changed sponsors move to the end of the new
-- tier, and rows with an unchanged tier keep their display_order untouched.

CREATE OR REPLACE FUNCTION public.sponsor_import_publish_batch(
  p_batch_id uuid,
  p_published_by uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch public.sponsor_import_batches%ROWTYPE;
  v_link public.sponsor_import_draft_links%ROWTYPE;
  v_live_id uuid;
  v_live_tier integer;
  v_next_order integer;
  v_new_count integer := 0;
  v_tier_updated_count integer := 0;
  v_unchanged_count integer := 0;
  v_excluded_count integer := 0;
BEGIN
  SELECT * INTO v_batch
  FROM public.sponsor_import_batches
  WHERE id = p_batch_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'batch_not_found';
  END IF;

  IF v_batch.status <> 'draft' THEN
    RAISE EXCEPTION 'invalid_batch_status:%', v_batch.status;
  END IF;

  IF v_batch.review_acknowledged_at IS NULL THEN
    RAISE EXCEPTION 'review_not_acknowledged';
  END IF;

  UPDATE public.sponsor_import_batches
  SET processing_phase = 'publishing', updated_at = now()
  WHERE id = p_batch_id;

  FOR v_link IN
    SELECT *
    FROM public.sponsor_import_draft_links
    WHERE batch_id = p_batch_id
    ORDER BY created_at, id
  LOOP
    IF v_link.excluded_from_publish THEN
      v_excluded_count := v_excluded_count + 1;
      CONTINUE;
    END IF;

    SELECT id, tier_rank
    INTO v_live_id, v_live_tier
    FROM public.event_sponsors
    WHERE event_editions_id = v_link.event_edition_id
      AND company_id = v_link.company_id;

    IF v_live_id IS NULL THEN
      SELECT COALESCE(MAX(display_order), 0) + 1
      INTO v_next_order
      FROM public.event_sponsors
      WHERE event_editions_id = v_link.event_edition_id
        AND tier_rank IS NOT DISTINCT FROM v_link.tier_rank;

      INSERT INTO public.event_sponsors
        (event_editions_id, company_id, tier_rank, display_order)
      VALUES
        (v_link.event_edition_id, v_link.company_id, v_link.tier_rank, v_next_order);
      v_new_count := v_new_count + 1;
    ELSIF v_live_tier IS DISTINCT FROM v_link.tier_rank THEN
      SELECT COALESCE(MAX(display_order), 0) + 1
      INTO v_next_order
      FROM public.event_sponsors
      WHERE event_editions_id = v_link.event_edition_id
        AND tier_rank IS NOT DISTINCT FROM v_link.tier_rank;

      UPDATE public.event_sponsors
      SET tier_rank = v_link.tier_rank,
          display_order = v_next_order
      WHERE id = v_live_id;
      v_tier_updated_count := v_tier_updated_count + 1;
    ELSE
      v_unchanged_count := v_unchanged_count + 1;
    END IF;
  END LOOP;

  UPDATE public.sponsor_import_batches
  SET
    status = 'published',
    processing_phase = NULL,
    published_by = p_published_by,
    published_at = now(),
    updated_at = now()
  WHERE id = p_batch_id;

  RETURN jsonb_build_object(
    'new_count', v_new_count,
    'tier_updated_count', v_tier_updated_count,
    'unchanged_count', v_unchanged_count,
    'excluded_count', v_excluded_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sponsor_import_publish_batch(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sponsor_import_publish_batch(uuid, uuid) TO service_role;
