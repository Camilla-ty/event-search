import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AdminBreadcrumbs } from "@/src/features/admin/components/AdminBreadcrumbs";
import { AdminPageHeader } from "@/src/features/admin/components/AdminPageHeader";
import { BatchTerminalView } from "@/src/features/partner-alumni-import/components/BatchTerminalView";
import { PartnerAlumniImportFlow } from "@/src/features/partner-alumni-import/components/PartnerAlumniImportFlow";
import {
  parseImportStep,
  resolveStepForBatch,
} from "@/src/features/partner-alumni-import/client/resumeStep";
import type { PartnerAlumniImportBatchStatus } from "@/src/features/partner-alumni-import/types";
import { getVersionImportContext } from "@/src/features/partner-alumni-import/server/importUiData";
import { mapBatchForClient } from "@/src/features/partner-alumni-import/server/mapClientBatch";
import { getBatchAdmin } from "@/src/features/partner-alumni-import/server/partnerAlumniImportAdmin";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string; versionId: string; batchId: string }>;
  searchParams: Promise<{ step?: string }>;
};

export default async function PartnerAlumniImportBatchPage({ params, searchParams }: PageProps) {
  const { id: seriesId, versionId, batchId } = await params;
  const { step: stepRaw } = await searchParams;
  const scope = { seriesId, versionId };

  let result: Awaited<ReturnType<typeof getBatchAdmin>>;
  try {
    result = await getBatchAdmin(batchId, scope);
  } catch {
    notFound();
  }

  const versionContext = await getVersionImportContext(seriesId, versionId);
  if (!versionContext) notFound();

  const batchRaw = result.batch as Record<string, unknown>;
  const status = String(batchRaw.status) as PartnerAlumniImportBatchStatus;

  const requestedStep = parseImportStep(stepRaw);
  const step = resolveStepForBatch(status, requestedStep);

  const basePath = `/admin/events/series/${seriesId}/partner-alumni/versions/${versionId}/import/${batchId}`;
  if (requestedStep !== step && stepRaw) {
    redirect(`${basePath}?step=${step}`);
  }

  const isTerminal = status === "discarded";
  const showFlow = !isTerminal;

  return (
    <section>
      <AdminBreadcrumbs
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Event series", href: "/admin/events/series" },
          { label: versionContext.seriesName, href: `/admin/events/series/${seriesId}` },
          { label: String(batchRaw.source_filename) },
        ]}
      />
      <AdminPageHeader
        title={status === "imported" ? "Import complete" : isTerminal ? "Import details" : "Partner Alumni import"}
        description={`${versionContext.seriesName} · ${versionContext.versionLabel}`}
        actions={
          <Link
            href={`/admin/events/series/${seriesId}`}
            className="text-sm text-brand-primary hover:underline"
          >
            Series Partner Alumni
          </Link>
        }
      />

      {showFlow ? (
        <PartnerAlumniImportFlow
          scope={scope}
          batch={mapBatchForClient(batchRaw)}
          summary={result.summary}
          matchMethodSummary={result.match_method_summary}
          materializePreview={result.materialize_preview}
          pendingCreateNewCount={result.pending_create_new_count}
          version={{
            seriesName: versionContext.seriesName,
            versionLabel: versionContext.versionLabel,
            warnings: versionContext.warnings,
          }}
          step={step}
          spreadsheetHeaders={result.headers ?? []}
        />
      ) : (
        <BatchTerminalView
          scope={scope}
          batchId={batchId}
          status={status}
          filename={String(batchRaw.source_filename)}
          seriesName={versionContext.seriesName}
          versionLabel={versionContext.versionLabel}
          rowCount={Number(batchRaw.source_row_count)}
        />
      )}
    </section>
  );
}
