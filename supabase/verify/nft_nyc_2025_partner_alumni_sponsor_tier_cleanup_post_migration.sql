-- Post-migration verification for
-- 20260826120000_delete_nft_nyc_2025_partner_alumni_sponsor_tier.sql
-- NFT.NYC 2025 edition: e64f2830-df7b-433f-af6b-4952e389902d
-- NFT NYC series:       7fbab604-381c-4bf4-aac2-af25cabe2022

-- Edition sponsor total (expect 27)
SELECT COUNT(*)::int AS edition_sponsor_total
FROM public.event_sponsors
WHERE event_editions_id = 'e64f2830-df7b-433f-af6b-4952e389902d';

-- Remaining tiers (expect only 2025 Partner / 27)
SELECT tier_rank, tier_label, COUNT(*)::int AS sponsor_count
FROM public.event_sponsors
WHERE event_editions_id = 'e64f2830-df7b-433f-af6b-4952e389902d'
GROUP BY tier_rank, tier_label
ORDER BY tier_rank NULLS LAST, tier_label;

-- Alumni-tier sponsor rows must be gone (expect 0)
SELECT COUNT(*)::int AS alumni_tier_sponsor_rows
FROM public.event_sponsors
WHERE event_editions_id = 'e64f2830-df7b-433f-af6b-4952e389902d'
  AND tier_label = 'Partner Alumni'
  AND tier_rank = 2;

-- Aggregate view should match remaining sponsors (expect 27 / one tier)
SELECT event_editions_id, sponsor_count
FROM public.event_edition_sponsor_counts
WHERE event_editions_id = 'e64f2830-df7b-433f-af6b-4952e389902d';

SELECT event_editions_id, tier_rank, tier_label, sponsor_count
FROM public.event_edition_sponsor_tier_stats
WHERE event_editions_id = 'e64f2830-df7b-433f-af6b-4952e389902d'
ORDER BY tier_rank NULLS LAST;

-- Partner Alumni public roster unchanged (expect 454)
SELECT COUNT(*)::int AS partner_alumni_public_members
FROM public.event_partner_alumni_public_members
WHERE event_series_id = '7fbab604-381c-4bf4-aac2-af25cabe2022';
