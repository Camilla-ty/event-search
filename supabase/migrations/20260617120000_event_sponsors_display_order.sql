-- Same-tier sponsor ordering. `display_order` is a dense 1..n position within
-- (event_editions_id, tier_rank), managed exclusively by the app (move
-- endpoint, append-on-create, append-on-tier-change) — never typed by admins.
-- Nullable by design: legacy/missed rows sort last and are renumbered the
-- next time their tier is reordered.

alter table public.event_sponsors
  add column if not exists display_order integer;

-- Backfill dense per-tier numbering. Order by company name (then link id) so
-- the explicit starting order matches what admins effectively see today.
with ordered as (
  select
    es.id,
    row_number() over (
      partition by es.event_editions_id, es.tier_rank
      order by c.name nulls last, es.id
    ) as rn
  from public.event_sponsors es
  left join public.companies c on c.id = es.company_id
)
update public.event_sponsors es
set display_order = ordered.rn
from ordered
where es.id = ordered.id
  and es.display_order is null;

-- Replace the tier index with one covering the full canonical sort.
drop index if exists public.event_sponsors_edition_tier_rank_idx;

create index if not exists event_sponsors_edition_tier_order_idx
  on public.event_sponsors (event_editions_id, tier_rank, display_order);
