"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { InlineErrorBanner } from "@/src/components/common";
import { WarningBanner } from "@/src/features/admin/components/WarningBanner";
import {
  defaultStepForBatchStatus,
  flowHref,
} from "@/src/features/sponsor-import/client/resumeStep";
import type { SponsorImportBatchStatus } from "@/src/features/sponsor-import/types";

import { EditionLiveSponsorsQARoster } from "./EditionLiveSponsorsQARoster";
import { EditionSponsorsQAHeader } from "./EditionSponsorsQAHeader";
import { CompanyLogoDrawer } from "./CompanyLogoDrawer";
import {
  countDistinctTiers,
  filterSponsorsBySearch,
} from "./liveSponsorQaUtils";
import {
  applyTierDisplayOrder,
  computeMoveOrderedLinkIdsForSponsors,
} from "./liveSponsorReorderClient";
import { applyLiveSponsorCompanyLogoUpdate } from "./liveSponsorLogoUpdate";
import type { LiveSponsorCompanyLogoUpdate, LiveSponsorRow, SponsorMoveDirection } from "./liveSponsorTypes";
import { RemoveSponsorModal } from "./RemoveSponsorModal";
import { SponsorLinkDrawer } from "./SponsorLinkDrawer";

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
};

export function EditionSponsorsPanel({
  editionId,
  editionName,
  editionYear,
  editionSlug,
  eventWebsiteUrl,
  sponsors,
  activeImport,
}: EditionSponsorsPanelProps) {
  const router = useRouter();
  const [action, setAction] = useState<PanelAction>(null);
  const [movePending, setMovePending] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [rosterSponsors, setRosterSponsors] = useState<LiveSponsorRow[]>(sponsors);

  useEffect(() => {
    setRosterSponsors(sponsors);
  }, [sponsors]);

  const tierCount = useMemo(() => countDistinctTiers(rosterSponsors), [rosterSponsors]);
  const filteredSponsors = useMemo(
    () => filterSponsorsBySearch(rosterSponsors, searchQuery),
    [rosterSponsors, searchQuery],
  );
  const emptySearch = searchQuery.trim() !== "" && filteredSponsors.length === 0;
  const reorderDisabled = searchQuery.trim() !== "" || movePending;

  const attachedCompanyIds = new Set<string>();
  for (const sponsor of rosterSponsors) {
    const companyId = sponsor.companies?.id;
    if (typeof companyId === "string" && companyId !== "") {
      attachedCompanyIds.add(companyId);
    }
  }

  function handleDone() {
    setAction(null);
    router.refresh();
  }

  async function handleReorderTier(tierRank: number | null, orderedLinkIds: readonly string[]) {
    const snapshot = rosterSponsors;
    setRosterSponsors(applyTierDisplayOrder(snapshot, tierRank, orderedLinkIds));
    setMovePending(true);
    setMoveError(null);

    try {
      const res = await fetch(`/api/admin/event-editions/${editionId}/sponsors/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier_rank: tierRank,
          ordered_link_ids: [...orderedLinkIds],
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setRosterSponsors(snapshot);
        setMoveError(data.error ?? "Failed to reorder sponsors.");
        return;
      }
    } catch {
      setRosterSponsors(snapshot);
      setMoveError("Failed to reorder sponsors.");
    } finally {
      setMovePending(false);
    }
  }

  function handleLogoUpdated(companyId: string, update: LiveSponsorCompanyLogoUpdate) {
    setRosterSponsors((current) => applyLiveSponsorCompanyLogoUpdate(current, companyId, update));
  }

  function handleMove(row: LiveSponsorRow, direction: SponsorMoveDirection) {
    if (reorderDisabled) {
      return;
    }

    const nextOrder = computeMoveOrderedLinkIdsForSponsors(rosterSponsors, row, direction);
    if (nextOrder === null) {
      return;
    }

    void handleReorderTier(row.tier_rank, nextOrder);
  }

  return (
    <div className="space-y-4">
      {activeImport ? (
        <WarningBanner
          title="Import in progress"
          messages={[
            "An import batch is in progress for this edition. Tier changes and removals made here may be overwritten or re-added when that batch is published.",
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
        sponsorCount={rosterSponsors.length}
        tierCount={tierCount}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        editionSlug={editionSlug}
        eventWebsiteUrl={eventWebsiteUrl}
        onAddSponsor={() => setAction({ type: "create" })}
      />

      {searchQuery.trim() !== "" ? (
        <p className="text-sm text-slate-500">Clear search to reorder sponsors.</p>
      ) : null}

      {movePending ? (
        <p className="text-sm text-slate-500" role="status" aria-live="polite">
          Saving order…
        </p>
      ) : null}

      {moveError ? <InlineErrorBanner message={moveError} /> : null}

      <EditionLiveSponsorsQARoster
        sponsors={filteredSponsors}
        emptySearch={emptySearch}
        onEdit={(row) => setAction({ type: "edit", row })}
        onLogo={(row) => setAction({ type: "logo", row })}
        onRemove={(row) => setAction({ type: "remove", row })}
        onMove={(row, direction) => handleMove(row, direction)}
        onReorderTier={(tierRank, orderedLinkIds) =>
          void handleReorderTier(tierRank, orderedLinkIds)
        }
        reorderDisabled={reorderDisabled}
      />

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
          onSaved={handleDone}
        />
      ) : null}

      {action?.type === "create" ? (
        <SponsorLinkDrawer
          mode="create"
          editionId={editionId}
          attachedCompanyIds={attachedCompanyIds}
          onClose={() => setAction(null)}
          onSaved={handleDone}
        />
      ) : null}

      {action?.type === "remove" ? (
        <RemoveSponsorModal
          row={action.row}
          editionName={editionName}
          editionYear={editionYear}
          onClose={() => setAction(null)}
          onRemoved={handleDone}
        />
      ) : null}
    </div>
  );
}
