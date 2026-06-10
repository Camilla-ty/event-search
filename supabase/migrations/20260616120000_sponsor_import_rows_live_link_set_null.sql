-- `already_on_live_sponsor_id` is a diagnostic snapshot of which live link an
-- import row matched, not an ownership reference. Relax the FK so live
-- sponsor links can be deleted from the roster; `already_on_live_tier_rank`
-- keeps the historical tier for audit purposes.
alter table public.sponsor_import_rows
  drop constraint sponsor_import_rows_already_on_live_sponsor_id_fkey;

alter table public.sponsor_import_rows
  add constraint sponsor_import_rows_already_on_live_sponsor_id_fkey
  foreign key (already_on_live_sponsor_id)
  references public.event_sponsors (id)
  on delete set null;
