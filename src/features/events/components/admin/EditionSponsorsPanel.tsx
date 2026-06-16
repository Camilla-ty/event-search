"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button, InlineErrorBanner } from "@/src/components/common";
import { WarningBanner } from "@/src/features/admin/components/WarningBanner";
import { BrandfetchUpgradeBatchToolbar } from "@/src/features/companies/components/admin/BrandfetchUpgradeBatchToolbar";
import type { BrandfetchUpgradeBatchItem } from "@/src/lib/companies/brandfetchUpgradeBatchClient";
import {
  defaultStepForBatchStatus,
  flowHref,
} from "@/src/features/sponsor-import/client/resumeStep";
import type { SponsorImportBatchStatus } from "@/src/features/sponsor-import/types";

import {
  EditionLiveSponsorsTable,
  type LiveSponsorRow,
  type SponsorMoveDirection,
} from "./EditionLiveSponsorsTable";
import { RemoveSponsorModal } from "./RemoveSponsorModal";
import { SponsorLinkDrawer } from "./SponsorLinkDrawer";

export type ActiveImportInfo = {
  batchId: string;
  status: SponsorImportBatchStatus;
};

type PanelAction =
  | { type: "edit"; row: LiveSponsorRow }
  | { type: "create" }
  | { type: "remove"; row: LiveSponsorRow }
  | null;

type EditionSponsorsPanelProps = {
  editionId: string;
  editionName: string;
  editionYear: number;
  sponsors: LiveSponsorRow[];
  activeImport: ActiveImportInfo | null;
};

export function EditionSponsorsPanel({
  editionId,
  editionName,
  editionYear,
  sponsors,
  activeImport,
}: EditionSponsorsPanelProps) {
  const router = useRouter();
  const [action, setAction] = useState<PanelAction>(null);
  const [movePending, setMovePending] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<Set<string>>(() => new Set());

  const batchItems = useMemo((): BrandfetchUpgradeBatchItem[] => {
    const seen = new Set<string>();
    const items: BrandfetchUpgradeBatchItem[] = [];

    for (const sponsor of sponsors) {
      const company = sponsor.companies;
      if (!company || company.id === "" || seen.has(company.id)) {
        continue;
      }
      seen.add(company.id);
      items.push({
        companyId: company.id,
        name: company.name?.trim() || "—",
        domain: company.domain,
        logo_url: company.logo_url,
        logo_source: company.logo_source,
        logo_status: company.logo_status,
      });
    }

    return items;
  }, [sponsors]);

  const allCompanyIds = useMemo(
    () => batchItems.map((item) => item.companyId),
    [batchItems],
  );

  const attachedCompanyIds = new Set<string>();
  for (const sponsor of sponsors) {
    const companyId = sponsor.companies?.id;
    if (typeof companyId === "string" && companyId !== "") {
      attachedCompanyIds.add(companyId);
    }
  }

  function handleDone() {
    setAction(null);
    router.refresh();
  }

  async function handleMove(row: LiveSponsorRow, direction: SponsorMoveDirection) {
    setMovePending(true);
    setMoveError(null);
    try {
      const res = await fetch(`/api/admin/event-sponsors/${row.id}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setMoveError(data.error ?? "Failed to reorder sponsor.");
        setMovePending(false);
        return;
      }
      router.refresh();
      setMovePending(false);
    } catch {
      setMoveError("Failed to reorder sponsor.");
      setMovePending(false);
    }
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

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">
          {sponsors.length} live sponsor{sponsors.length === 1 ? "" : "s"}
        </p>
        <Button onClick={() => setAction({ type: "create" })}>Add sponsor</Button>
      </div>

      {moveError ? <InlineErrorBanner message={moveError} /> : null}

      <BrandfetchUpgradeBatchToolbar
        items={batchItems}
        selectedCompanyIds={selectedCompanyIds}
        disabled={movePending}
      />

      <EditionLiveSponsorsTable
        sponsors={sponsors}
        selectable
        selectedCompanyIds={selectedCompanyIds}
        allCompanyIds={allCompanyIds}
        onToggleCompany={(companyId, checked) => {
          setSelectedCompanyIds((previous) => {
            const next = new Set(previous);
            if (checked) {
              next.add(companyId);
            } else {
              next.delete(companyId);
            }
            return next;
          });
        }}
        onToggleAllCompanies={(checked) => {
          setSelectedCompanyIds(checked ? new Set(allCompanyIds) : new Set());
        }}
        onEdit={(row) => setAction({ type: "edit", row })}
        onRemove={(row) => setAction({ type: "remove", row })}
        onMove={(row, direction) => void handleMove(row, direction)}
        moveDisabled={movePending}
      />

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
