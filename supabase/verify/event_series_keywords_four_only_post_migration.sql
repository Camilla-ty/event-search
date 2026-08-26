-- Verify four-keyword Event Series reassignment + primary_industry rollback.

-- Column must be gone
SELECT EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'event_series'
    AND column_name = 'primary_industry_keyword_id'
) AS primary_industry_column_still_exists;

-- Assignment counts by target keyword
SELECT k.slug, k.name, COUNT(esk.series_id)::int AS series_count
FROM public.keyword k
LEFT JOIN public.event_series_keyword esk ON esk.keyword_id = k.id
WHERE k.slug IN ('ai', 'fintech', 'healthtech', 'crypto-blockchain')
GROUP BY k.slug, k.name
ORDER BY k.slug;

SELECT COUNT(*)::int AS total_assignments FROM public.event_series_keyword;

SELECT COUNT(*)::int AS unassigned_series
FROM public.event_series es
WHERE NOT EXISTS (
  SELECT 1 FROM public.event_series_keyword esk WHERE esk.series_id = es.id
);

-- Non-target keywords still referenced by series (should be 0)
SELECT k.slug, k.name, COUNT(*)::int AS series_links
FROM public.event_series_keyword esk
JOIN public.keyword k ON k.id = esk.keyword_id
WHERE k.slug NOT IN ('ai', 'fintech', 'healthtech', 'crypto-blockchain')
GROUP BY k.slug, k.name
ORDER BY k.name;

-- Catalog rows still referenced by research pages (keep these keywords)
SELECT k.slug, k.name, COUNT(*)::int AS research_pages
FROM public.topic_region_research_pages tr
JOIN public.keyword k ON k.id = tr.topic_keyword_id
GROUP BY k.slug, k.name
ORDER BY research_pages DESC, k.name;
