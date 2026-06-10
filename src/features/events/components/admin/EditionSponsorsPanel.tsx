"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/src/components/common";
import { WarningBanner } from "@/src/features/admin/components/WarningBanner";
import {
  defaultStepForBatchStatus,
  flowHref,
} from "@/src/features/sponsor-import/client/resumeStep";
import type { SponsorImportBatchStatus } from "@/src/features/sponsor-import/types";

import {
  EditionLiveSponsorsTable,
  type LiveSponsorRow,
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

      <EditionLiveSponsorsTable
        sponsors={sponsors}
        onEdit={(row) => setAction({ type: "edit", row })}
        onRemove={(row) => setAction({ type: "remove", row })}
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
