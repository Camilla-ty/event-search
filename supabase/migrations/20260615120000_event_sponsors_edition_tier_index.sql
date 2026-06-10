-- Supports the canonical roster read: filter by edition, order by tier_rank.
-- The existing unique index (event_editions_id, company_id) covers the filter
-- but not the sort.
create index if not exists event_sponsors_edition_tier_rank_idx
  on public.event_sponsors (event_editions_id, tier_rank);
