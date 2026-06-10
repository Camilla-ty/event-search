"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

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
import { SponsorLinkDrawer } from "./SponsorLinkDrawer";

export type ActiveImportInfo = {
  batchId: string;
  status: SponsorImportBatchStatus;
};

type EditionSponsorsPanelProps = {
  sponsors: LiveSponsorRow[];
  activeImport: ActiveImportInfo | null;
};

export function EditionSponsorsPanel({
  sponsors,
  activeImport,
}: EditionSponsorsPanelProps) {
  const router = useRouter();
  const [editingRow, setEditingRow] = useState<LiveSponsorRow | null>(null);

  function handleSaved() {
    setEditingRow(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {activeImport ? (
        <WarningBanner
          title="Import in progress"
          messages={[
            "An import batch is in progress for this edition. Tier changes made here may be overwritten when that batch is published.",
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

      <EditionLiveSponsorsTable sponsors={sponsors} onEdit={setEditingRow} />

      <SponsorLinkDrawer
        row={editingRow}
        onClose={() => setEditingRow(null)}
        onSaved={handleSaved}
      />
    </div>
  );
}
