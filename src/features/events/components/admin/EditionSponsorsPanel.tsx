"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { WarningBanner } from "@/src/features/admin/components/WarningBanner";
import { fetchEditionLiveSponsors } from "@/src/features/events/client/fetchEditionLiveSponsors";
import {
  defaultStepForBatchStatus,
  flowHref,
} from "@/src/features/sponsor-import/client/resumeStep";
import type { SponsorImportBatchStatus } from "@/src/features/sponsor-import/types";

import { EditionLiveSponsorsQARoster } from "./EditionLiveSponsorsQARoster";
import { EditionSponsorNote } from "@/src/features/events/components/detail/EditionSponsorNote";
import type { SponsorNoteType } from "@/src/features/events/lib/sponsorNoteType";
import { EditionSponsorsQAHeader } from "./EditionSponsorsQAHeader";
import { useEditionLiveSponsorCount } from "./EditionLiveSponsorCountContext";
import { CompanyLogoDrawer } from "./CompanyLogoDrawer";
import {
  countDistinctTiers,
  filterSponsorsBySearch,
} from "./liveSponsorQaUtils";
import {
  applySponsorCreate,
  applySponsorLabelEdit,
  applySponsorRemove,
  applyRefetchedRoster,
} from "./liveSponsorRosterMutations";
import {
  applyTierDisplayOrder,
  computeMoveOrderedLinkIdsForSponsors,
  getDirtyTierOrders,
  isRosterOrderDirty,
} from "./liveSponsorReorderClient";
import { applyLiveSponsorCompanyLogoUpdate } from "./liveSponsorLogoUpdate";
import type { LiveSponsorCompanyLogoUpdate, LiveSponsorRow, SponsorMoveDirection } from "./liveSponsorTypes";
import {
  LiveSponsorOrderSaveFooter,
  type LiveSponsorOrderSaveBarState,
} from "./LiveSponsorOrderSaveBar";
import { RemoveSponsorModal } from "./RemoveSponsorModal";
import { SponsorLinkDrawer } from "./SponsorLinkDrawer";
import type {
  SponsorCreateSavedPayload,
  SponsorEditSavedPayload,
} from "./sponsorLinkDrawerTypes";

const ORDER_SAVE_CONFIRM_MS = 2500;

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

const UNSAVED_ORDER_CONFIRM_MESSAGE =
  "You have unsaved order changes. Continue and discard them?";

export type ActiveImportInfo = {
  batchId: string;
  status: SponsorImportBatchStatus;
};

type PanelAction =
  | { type: "edit"; row: LiveSponsorRow }
  | { type: "logo"; row: LiveSponsorRow }
  | { type: "create" }
  | { type: "remove"; row: LiveSponsorRow }
  | null;

type EditionSponsorsPanelProps = {
  editionId: string;
  editionName: string;
  editionYear: number;
  editionSlug: string;
  eventWebsiteUrl: string | null;
  sponsors: LiveSponsorRow[];
  activeImport: ActiveImportInfo | null;
  sponsorNoteType?: SponsorNoteType | null;
};

export function EditionSponsorsPanel({
  editionId,
  editionName,
  editionYear,
  editionSlug,
  eventWebsiteUrl,
  sponsors,
  activeImport,
  sponsorNoteType = null,
}: EditionSponsorsPanelProps) {
  const { setLiveSponsorCount } = useEditionLiveSponsorCount();
  const [action, setAction] = useState<PanelAction>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [orderSaveJustSaved, setOrderSaveJustSaved] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [savedRoster, setSavedRoster] = useState<LiveSponsorRow[]>(sponsors);
  const [draftRoster, setDraftRoster] = useState<LiveSponsorRow[]>(sponsors);

  const savedRosterRef = useRef(savedRoster);
  const draftRosterRef = useRef(draftRoster);
  savedRosterRef.current = savedRoster;
  draftRosterRef.current = draftRoster;

  useEffect(() => {
    if (isRosterOrderDirty(savedRosterRef.current, draftRosterRef.current)) {
      setSavedRoster(sponsors);
      return;
    }
    setSavedRoster(sponsors);
    setDraftRoster(sponsors);
  }, [sponsors]);

  const isOrderDirty = useMemo(
    () => isRosterOrderDirty(savedRoster, draftRoster),
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

  const tierCount = useMemo(() => countDistinctTiers(draftRoster), [draftRoster]);
  const filteredSponsors = useMemo(
    () => filterSponsorsBySearch(draftRoster, searchQuery),
    [draftRoster, searchQuery],
  );
  const emptySearch = searchQuery.trim() !== "" && filteredSponsors.length === 0;
  const reorderDisabled = searchQuery.trim() !== "" || isSaving;
  const showSponsorNote =
    draftRoster.length === 0 && sponsorNoteType !== null && sponsorNoteType !== undefined;

  const attachedCompanyIds = new Set<string>();
  for (const sponsor of draftRoster) {
    const companyId = sponsor.companies?.id;
    if (typeof companyId === "string" && companyId !== "") {
      attachedCompanyIds.add(companyId);
    }
  }

  function syncLiveSponsorCount(count: number) {
    setLiveSponsorCount(count);
  }

  function applyRosterPair(next: { savedRoster: LiveSponsorRow[]; draftRoster: LiveSponsorRow[] }) {
    setSavedRoster(next.savedRoster);
    setDraftRoster(next.draftRoster);
    syncLiveSponsorCount(next.draftRoster.length);
  }

  async function refetchSponsorsAndSyncRoster(): Promise<boolean> {
    try {
      const data = await fetchEditionLiveSponsors(editionId);
      const next = applyRefetchedRoster(
        data.sponsors,
        savedRosterRef.current,
        draftRosterRef.current,
      );
      applyRosterPair(next);
      syncLiveSponsorCount(data.count);
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

  function closePanelAction() {
    setAction(null);
  }

  function handleSponsorCreated(payload: SponsorCreateSavedPayload) {
    const nextRoster = applySponsorCreate(
      savedRosterRef.current,
      payload.link,
      payload.company,
    );
    applyRosterPair({ savedRoster: nextRoster, draftRoster: nextRoster });
    closePanelAction();
  }

  function handleSponsorRemoved(linkId: string) {
    const nextRoster = applySponsorRemove(savedRosterRef.current, linkId);
    applyRosterPair({ savedRoster: nextRoster, draftRoster: nextRoster });
    closePanelAction();
  }

  async function handleSponsorEdited(payload: SponsorEditSavedPayload) {
    if (payload.kind === "tier") {
      closePanelAction();
      const refreshed = await refetchSponsorsAndSyncRoster();
      if (!refreshed) {
        setSaveError(
          "Sponsor saved but the roster could not be refreshed. Review the roster or reload the page.",
        );
      }
      return;
    }

    const nextRoster = applySponsorLabelEdit(
      savedRosterRef.current,
      payload.linkId,
      payload.tier_label,
    );
    applyRosterPair({ savedRoster: nextRoster, draftRoster: nextRoster });
    closePanelAction();
  }

  function handleLocalReorderTier(tierRank: number | null, orderedLinkIds: readonly string[]) {
    setDraftRoster((current) => applyTierDisplayOrder(current, tierRank, orderedLinkIds));
    setSaveError(null);
    setOrderSaveJustSaved(false);
  }

  async function handleSaveOrder() {
    const dirtyTiers = getDirtyTierOrders(savedRoster, draftRoster);
    if (dirtyTiers.length === 0 || isSaving) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setOrderSaveJustSaved(false);

    try {
      for (const tier of dirtyTiers) {
        const res = await fetch(`/api/admin/event-editions/${editionId}/sponsors/reorder`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tier_rank: tier.tier_rank,
            ordered_link_ids: tier.ordered_link_ids,
          }),
        });
        const data = (await res.json()) as { ok: boolean; error?: string };
        if (!res.ok || !data.ok) {
          setSaveError(
            data.error ??
              "Failed to save order. Some tiers may have been saved — review the roster and try again.",
          );
          await refetchSponsorsAndSyncRoster();
          return;
        }
      }

      setSavedRoster(draftRoster);
      setOrderSaveJustSaved(true);
    } catch {
      setSaveError(
        "Failed to save order. Some tiers may have been saved — review the roster and try again.",
      );
      await refetchSponsorsAndSyncRoster();
    } finally {
      setIsSaving(false);
    }
  }

  function handleResetOrder() {
    discardUnsavedOrderChanges();
  }

  function handleLogoUpdated(companyId: string, update: LiveSponsorCompanyLogoUpdate) {
    setDraftRoster((current) => applyLiveSponsorCompanyLogoUpdate(current, companyId, update));
    setSavedRoster((current) => applyLiveSponsorCompanyLogoUpdate(current, companyId, update));
  }

  function handleMove(row: LiveSponsorRow, direction: SponsorMoveDirection) {
    if (reorderDisabled) {
      return;
    }

    const nextOrder = computeMoveOrderedLinkIdsForSponsors(draftRoster, row, direction);
    if (nextOrder === null) {
      return;
    }

    handleLocalReorderTier(row.tier_rank, nextOrder);
  }

  function openPanelAction(next: Exclude<PanelAction, null>) {
    if (!confirmDiscardUnsavedOrder()) {
      return;
    }
    discardUnsavedOrderChanges();
    setAction(next);
  }

  return (
    <div className={showOrderSaveFooter ? "pb-28" : undefined}>
      <div className="space-y-4">
      {activeImport ? (
        <WarningBanner
          title="Import in progress"
          messages={[
            "An import batch is in progress for this event. Tier changes and removals made here may be overwritten or re-added when that batch is published.",
          ]}
          action={
            <Link
              href={flowHref(
                activeImport.batchId,
                defaultStepForBatchStatus(activeImport.status),
              )}
              className="font-medium text-brand-primary hover:underline"
            >
              Resume import
            </Link>
          }
        />
      ) : null}

      <EditionSponsorsQAHeader
        sponsorCount={draftRoster.length}
        tierCount={tierCount}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        editionSlug={editionSlug}
        eventWebsiteUrl={eventWebsiteUrl}
        onAddSponsor={() => openPanelAction({ type: "create" })}
      />

      {searchQuery.trim() !== "" ? (
        <p className="text-sm text-slate-500">Clear search to reorder sponsors.</p>
      ) : null}

      <EditionLiveSponsorsQARoster
        sponsors={filteredSponsors}
        emptySearch={emptySearch}
        onEdit={(row) => openPanelAction({ type: "edit", row })}
        onLogo={(row) => setAction({ type: "logo", row })}
        onRemove={(row) => openPanelAction({ type: "remove", row })}
        onMove={(row, direction) => handleMove(row, direction)}
        onReorderTier={(tierRank, orderedLinkIds) =>
          handleLocalReorderTier(tierRank, orderedLinkIds)
        }
        reorderDisabled={reorderDisabled}
      />

      {showSponsorNote ? (
        <EditionSponsorNote sponsorNoteType={sponsorNoteType} />
      ) : null}

      {action?.type === "logo" ? (
        <CompanyLogoDrawer
          key={action.row.id}
          row={action.row}
          onClose={() => setAction(null)}
          onUpdated={handleLogoUpdated}
        />
      ) : null}

      {action?.type === "edit" ? (
        <SponsorLinkDrawer
          mode="edit"
          row={action.row}
          onClose={() => setAction(null)}
          onSaved={(payload) => void handleSponsorEdited(payload)}
        />
      ) : null}

      {action?.type === "create" ? (
        <SponsorLinkDrawer
          mode="create"
          editionId={editionId}
          attachedCompanyIds={attachedCompanyIds}
          onClose={() => setAction(null)}
          onSaved={handleSponsorCreated}
        />
      ) : null}

      {action?.type === "remove" ? (
        <RemoveSponsorModal
          row={action.row}
          editionName={editionName}
          editionYear={editionYear}
          onClose={() => setAction(null)}
          onRemoved={handleSponsorRemoved}
        />
      ) : null}
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
