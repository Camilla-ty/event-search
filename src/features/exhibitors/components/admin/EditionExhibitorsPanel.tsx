"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  LiveSponsorOrderSaveFooter,
  type LiveSponsorOrderSaveBarState,
} from "@/src/features/events/components/admin/LiveSponsorOrderSaveBar";
import { fetchEditionLiveExhibitors } from "@/src/features/exhibitors/client/fetchEditionLiveExhibitors";
import {
  applyExhibitorTierDisplayOrder,
  applyRefetchedExhibitorRoster,
  computeMoveOrderedLinkIdsForExhibitors,
  getDirtyExhibitorTierOrders,
  isExhibitorRosterOrderDirty,
} from "@/src/features/exhibitors/lib/liveExhibitorReorderClient";
import type {
  EventExhibitorLinkAdminRow,
  LiveExhibitorRow,
} from "@/src/features/exhibitors/server/eventExhibitorAdmin";
import { primaryCtaClass } from "@/src/lib/design/classes";
import type { ExhibitorMoveDirection } from "@/src/lib/validation/eventExhibitor";

import { EditionLiveExhibitorsQARoster } from "./EditionLiveExhibitorsQARoster";
import {
  ExhibitorLinkDrawer,
  type ExhibitorCreateSavedPayload,
  type ExhibitorEditSavedPayload,
} from "./ExhibitorLinkDrawer";
import { RemoveExhibitorModal } from "./RemoveExhibitorModal";
import { EditionImportsPanel } from "@/src/features/exhibitor-import/components/EditionImportsPanel";
import type { EditionImportContext } from "@/src/features/exhibitor-import/server/importUiData";

const ORDER_SAVE_CONFIRM_MS = 2500;

const UNSAVED_ORDER_CONFIRM_MESSAGE =
  "You have unsaved order changes. Continue and discard them?";

function resolveOrderSaveBarState(
  isSaving: boolean,
  saveError: string | null,
  orderSaveJustSaved: boolean,
): LiveSponsorOrderSaveBarState {
  if (isSaving) return "saving";
  if (saveError !== null) return "error";
  if (orderSaveJustSaved) return "saved";
  return "unsaved";
}

type EditionExhibitorsPanelProps = {
  editionId: string;
  editionName: string;
  editionYear: number;
  exhibitors: LiveExhibitorRow[];
  importsData: EditionImportContext;
};

type DrawerState =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; row: LiveExhibitorRow };

function applyLinkPatch(
  rows: LiveExhibitorRow[],
  link: EventExhibitorLinkAdminRow,
): LiveExhibitorRow[] {
  return rows.map((row) =>
    row.id === link.id
      ? {
          ...row,
          tier_rank: link.tier_rank,
          tier_label: link.tier_label,
          display_order: link.display_order,
        }
      : row,
  );
}

function sortExhibitorRoster(rows: LiveExhibitorRow[]): LiveExhibitorRow[] {
  return [...rows].sort((a, b) => {
    const ar = a.tier_rank;
    const br = b.tier_rank;
    if (ar === null && br !== null) return 1;
    if (ar !== null && br === null) return -1;
    if (ar !== null && br !== null && ar !== br) return ar - br;
    const ao = a.display_order ?? Number.MAX_SAFE_INTEGER;
    const bo = b.display_order ?? Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    return a.id.localeCompare(b.id);
  });
}

export function EditionExhibitorsPanel({
  editionId,
  editionName,
  editionYear,
  exhibitors: initialExhibitors,
  importsData,
}: EditionExhibitorsPanelProps) {
  const [drawer, setDrawer] = useState<DrawerState>({ kind: "closed" });
  const [removeRow, setRemoveRow] = useState<LiveExhibitorRow | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [orderSaveJustSaved, setOrderSaveJustSaved] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [savedRoster, setSavedRoster] = useState<LiveExhibitorRow[]>(initialExhibitors);
  const [draftRoster, setDraftRoster] = useState<LiveExhibitorRow[]>(initialExhibitors);

  const savedRosterRef = useRef(savedRoster);
  const draftRosterRef = useRef(draftRoster);

  useEffect(() => {
    savedRosterRef.current = savedRoster;
    draftRosterRef.current = draftRoster;
  }, [savedRoster, draftRoster]);

  useEffect(() => {
    if (isExhibitorRosterOrderDirty(savedRosterRef.current, draftRosterRef.current)) {
      setSavedRoster(initialExhibitors);
      return;
    }
    setSavedRoster(initialExhibitors);
    setDraftRoster(initialExhibitors);
  }, [initialExhibitors]);

  const isOrderDirty = useMemo(
    () => isExhibitorRosterOrderDirty(savedRoster, draftRoster),
    [savedRoster, draftRoster],
  );

  useEffect(() => {
    if (!isOrderDirty) {
      return;
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isOrderDirty]);

  useEffect(() => {
    if (!orderSaveJustSaved) {
      return;
    }

    const timer = window.setTimeout(() => {
      setOrderSaveJustSaved(false);
    }, ORDER_SAVE_CONFIRM_MS);

    return () => window.clearTimeout(timer);
  }, [orderSaveJustSaved]);

  const orderSaveBarState = resolveOrderSaveBarState(isSaving, saveError, orderSaveJustSaved);
  const showOrderSaveFooter =
    isOrderDirty || isSaving || orderSaveJustSaved || saveError !== null;

  const attachedCompanyIds = useMemo(
    () => new Set(draftRoster.map((row) => row.company_id)),
    [draftRoster],
  );

  const sortedDraftRoster = useMemo(() => sortExhibitorRoster(draftRoster), [draftRoster]);
  const reorderDisabled = isSaving;

  function applyRosterPair(next: {
    savedRoster: LiveExhibitorRow[];
    draftRoster: LiveExhibitorRow[];
  }) {
    setSavedRoster(next.savedRoster);
    setDraftRoster(next.draftRoster);
  }

  async function refetchExhibitorsAndSyncRoster(): Promise<boolean> {
    try {
      const fresh = await fetchEditionLiveExhibitors(editionId);
      const next = applyRefetchedExhibitorRoster(
        fresh,
        savedRosterRef.current,
        draftRosterRef.current,
      );
      applyRosterPair(next);
      setRosterError(null);
      return true;
    } catch {
      return false;
    }
  }

  function discardUnsavedOrderChanges() {
    setDraftRoster(savedRoster);
    setSaveError(null);
    setOrderSaveJustSaved(false);
  }

  function confirmDiscardUnsavedOrder(): boolean {
    if (!isOrderDirty) {
      return true;
    }
    return window.confirm(UNSAVED_ORDER_CONFIRM_MESSAGE);
  }

  function openDrawer(next: Exclude<DrawerState, { kind: "closed" }>) {
    if (!confirmDiscardUnsavedOrder()) {
      return;
    }
    discardUnsavedOrderChanges();
    setDrawer(next);
  }

  function openRemove(row: LiveExhibitorRow) {
    if (!confirmDiscardUnsavedOrder()) {
      return;
    }
    discardUnsavedOrderChanges();
    setRemoveRow(row);
  }

  function handleCreated(payload: ExhibitorCreateSavedPayload) {
    const next: LiveExhibitorRow = {
      id: payload.link.id,
      company_id: payload.link.company_id,
      tier_rank: payload.link.tier_rank,
      tier_label: payload.link.tier_label,
      display_order: payload.link.display_order,
      companies: {
        id: payload.company.id,
        name: payload.company.name,
        slug: null,
        domain: payload.company.domain,
        logo_url: payload.company.logo_url,
        logo_source: payload.company.logo_source,
      },
    };
    const nextRoster = sortExhibitorRoster([...savedRosterRef.current, next]);
    applyRosterPair({ savedRoster: nextRoster, draftRoster: nextRoster });
    setDrawer({ kind: "closed" });
    setRosterError(null);
    setSaveError(null);
    setOrderSaveJustSaved(false);
  }

  async function handleEdited(payload: ExhibitorEditSavedPayload) {
    setDrawer({ kind: "closed" });
    setRosterError(null);
    setSaveError(null);
    setOrderSaveJustSaved(false);
    if (payload.kind === "tier") {
      const refreshed = await refetchExhibitorsAndSyncRoster();
      if (!refreshed) {
        const nextRoster = sortExhibitorRoster(
          applyLinkPatch([...savedRosterRef.current], payload.link),
        );
        applyRosterPair({ savedRoster: nextRoster, draftRoster: nextRoster });
        setRosterError("Saved, but could not refresh the full roster. Reload if order looks off.");
      }
      return;
    }
    const nextRoster = applyLinkPatch([...savedRosterRef.current], payload.link);
    applyRosterPair({ savedRoster: nextRoster, draftRoster: nextRoster });
  }

  function handleRemoved(linkId: string) {
    const nextRoster = savedRosterRef.current.filter((row) => row.id !== linkId);
    applyRosterPair({ savedRoster: nextRoster, draftRoster: nextRoster });
    setRemoveRow(null);
    setRosterError(null);
    setSaveError(null);
    setOrderSaveJustSaved(false);
  }

  function handleLocalReorderTier(tierRank: number | null, orderedLinkIds: readonly string[]) {
    setDraftRoster((current) =>
      sortExhibitorRoster(applyExhibitorTierDisplayOrder(current, tierRank, orderedLinkIds)),
    );
    setSaveError(null);
    setOrderSaveJustSaved(false);
    setRosterError(null);
  }

  function handleMove(row: LiveExhibitorRow, direction: ExhibitorMoveDirection) {
    if (reorderDisabled) {
      return;
    }

    const nextOrder = computeMoveOrderedLinkIdsForExhibitors(draftRoster, row, direction);
    if (nextOrder === null) {
      return;
    }

    handleLocalReorderTier(row.tier_rank, nextOrder);
  }

  async function handleSaveOrder() {
    const dirtyTiers = getDirtyExhibitorTierOrders(savedRoster, draftRoster);
    if (dirtyTiers.length === 0 || isSaving) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setOrderSaveJustSaved(false);
    setRosterError(null);

    try {
      for (const tier of dirtyTiers) {
        const res = await fetch(
          `/api/admin/event-editions/${editionId}/exhibitors/reorder`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tier_rank: tier.tier_rank,
              ordered_link_ids: tier.ordered_link_ids,
            }),
          },
        );
        const data = (await res.json()) as { ok: boolean; error?: string };
        if (!res.ok || !data.ok) {
          setSaveError(
            data.error ??
              "Failed to save order. Some tiers may have been saved — review the roster and try again.",
          );
          await refetchExhibitorsAndSyncRoster();
          return;
        }
      }

      setSavedRoster(draftRoster);
      setOrderSaveJustSaved(true);
    } catch {
      setSaveError(
        "Failed to save order. Some tiers may have been saved — review the roster and try again.",
      );
      await refetchExhibitorsAndSyncRoster();
    } finally {
      setIsSaving(false);
    }
  }

  function handleResetOrder() {
    discardUnsavedOrderChanges();
  }

  return (
    <div className={showOrderSaveFooter ? "pb-28" : undefined}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            Link companies as exhibitors for this event edition. Group by tier; reorder within a
            tier. Save when the order looks right.
          </p>
          <button
            type="button"
            className={primaryCtaClass}
            onClick={() => openDrawer({ kind: "create" })}
          >
            Add exhibitor
          </button>
        </div>

        {rosterError ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {rosterError}
          </p>
        ) : null}

        {draftRoster.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
            No exhibitors yet.{" "}
            <button
              type="button"
              className="text-brand-primary hover:underline"
              onClick={() => openDrawer({ kind: "create" })}
            >
              Add the first exhibitor
            </button>
          </p>
        ) : (
          <EditionLiveExhibitorsQARoster
            exhibitors={sortedDraftRoster}
            onEdit={(row) => openDrawer({ kind: "edit", row })}
            onRemove={(row) => openRemove(row)}
            onMove={(row, direction) => handleMove(row, direction)}
            onReorderTier={(tierRank, orderedLinkIds) =>
              handleLocalReorderTier(tierRank, orderedLinkIds)
            }
            reorderDisabled={reorderDisabled}
          />
        )}

        {drawer.kind === "create" ? (
          <ExhibitorLinkDrawer
            mode="create"
            editionId={editionId}
            attachedCompanyIds={attachedCompanyIds}
            onClose={() => setDrawer({ kind: "closed" })}
            onSaved={handleCreated}
          />
        ) : null}

        {drawer.kind === "edit" ? (
          <ExhibitorLinkDrawer
            mode="edit"
            row={drawer.row}
            onClose={() => setDrawer({ kind: "closed" })}
            onSaved={(payload) => void handleEdited(payload)}
          />
        ) : null}

        {removeRow ? (
          <RemoveExhibitorModal
            row={removeRow}
            editionName={editionName}
            editionYear={editionYear}
            onClose={() => setRemoveRow(null)}
            onRemoved={handleRemoved}
          />
        ) : null}

        <div className="border-t border-slate-200 pt-6">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Bulk Upload</h3>
          <EditionImportsPanel data={importsData} />
        </div>
      </div>

      <LiveSponsorOrderSaveFooter
        visible={showOrderSaveFooter}
        state={orderSaveBarState}
        errorMessage={saveError}
        onSave={() => void handleSaveOrder()}
        onReset={handleResetOrder}
      />
    </div>
  );
}
