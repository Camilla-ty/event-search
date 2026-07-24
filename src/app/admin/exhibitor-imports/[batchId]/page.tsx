import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AdminBreadcrumbs } from "@/src/features/admin/components/AdminBreadcrumbs";
import { AdminPageHeader } from "@/src/features/admin/components/AdminPageHeader";
import { BatchTerminalView } from "@/src/features/exhibitor-import/components/BatchTerminalView";
import { ExhibitorImportFlow } from "@/src/features/exhibitor-import/components/ExhibitorImportFlow";
import {
  parseImportStep,
  resolveStepForBatch,
} from "@/src/features/exhibitor-import/client/resumeStep";
import type { ExhibitorImportBatchStatus } from "@/src/features/exhibitor-import/types";
import { getBatchEditionContext } from "@/src/features/exhibitor-import/server/importUiData";
import {
  mapBatchForClient,
  mapSummaryForClient,
} from "@/src/features/exhibitor-import/server/mapClientBatch";
import { getBatchAdmin } from "@/src/features/exhibitor-import/server/exhibitorImportAdmin";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ batchId: string }>;
  searchParams: Promise<{ step?: string }>;
};

export default async function ExhibitorImportBatchPage({ params, searchParams }: PageProps) {
  const { batchId } = await params;
  const { step: stepRaw } = await searchParams;

  let result: Awaited<ReturnType<typeof getBatchAdmin>>;
  try {
    result = await getBatchAdmin(batchId);
  } catch {
    notFound();
  }

  const batchRaw = result.batch as Record<string, unknown>;
  const status = String(batchRaw.status) as ExhibitorImportBatchStatus;
  const editionId = String(batchRaw.event_edition_id);

  const edition = await getBatchEditionContext(editionId);
  if (!edition) notFound();

  const requestedStep = parseImportStep(stepRaw);
  const step = resolveStepForBatch(status, requestedStep);
  const editionHref = `/admin/events/editions/${editionId}?tab=exhibitors`;

  if (requestedStep !== step && stepRaw) {
    redirect(`/admin/exhibitor-imports/${batchId}?step=${step}`);
  }

  const isTerminal = status === "published" || status === "discarded";

  return (
    <section>
      <AdminBreadcrumbs
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Events", href: "/admin/events" },
          { label: edition.name, href: editionHref },
          { label: String(batchRaw.source_filename) },
        ]}
      />
      <AdminPageHeader
        title={isTerminal ? "Import details" : "Exhibitor Bulk Upload"}
        description={
          isTerminal
            ? `${edition.seriesName ? `${edition.seriesName} · ` : ""}${edition.name} (${edition.year})`
            : `Import exhibitors for ${edition.name} (${edition.year})`
        }
        actions={
          <Link href={editionHref} className="text-sm text-brand-primary hover:underline">
            Back to exhibitors
          </Link>
        }
      />

      {isTerminal ? (
        <BatchTerminalView
          batchId={batchId}
          status={status}
          filename={String(batchRaw.source_filename)}
          editionId={editionId}
          editionName={edition.name}
          rowCount={Number(batchRaw.source_row_count)}
          publishedAt={
            batchRaw.published_at === null || typeof batchRaw.published_at === "string"
              ? batchRaw.published_at
              : null
          }
        />
      ) : (
        <ExhibitorImportFlow
          batch={mapBatchForClient(batchRaw)}
          summary={mapSummaryForClient(result.summary)}
          edition={{
            id: edition.id,
            name: edition.name,
            year: edition.year,
            seriesName: edition.seriesName,
            warnings: edition.warnings,
          }}
          step={step}
          spreadsheetHeaders={result.headers ?? []}
        />
      )}
    </section>
  );
}
