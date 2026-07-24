"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button, InlineErrorBanner } from "@/src/components/common";
import { primaryCtaClass } from "@/src/lib/design/classes";

import { fetchDraftLinks, publishBatch } from "../../client/api";
import type { DraftDiffSummary, PublishResult } from "../../client/types";
import { IMPORT_PROGRESS } from "../../importProgress";
import { useExhibitorImportWizard } from "../ExhibitorImportWizardContext";
import { useImportProgressLabel } from "../ImportFlowProgress";
import { ImportProgressMessage } from "../ImportProgressMessage";

type PublishStepProps = {
  editionId: string;
};

export function PublishStep({ editionId }: PublishStepProps) {
  const { batch, goToStep } = useExhibitorImportWizard();
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diff, setDiff] = useState<DraftDiffSummary | null>(null);
  const [result, setResult] = useState<PublishResult | null>(null);

  const progressLabel = publishing
    ? IMPORT_PROGRESS.publishing
    : loading
      ? IMPORT_PROGRESS.loadingPublishSummary
      : null;
  useImportProgressLabel(Boolean(progressLabel), progressLabel);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const links = await fetchDraftLinks(batch.id);
      if (cancelled) return;
      if (!links.ok) {
        setError(links.error);
      } else {
        setDiff(links.diff);
      }
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [batch.id]);

  async function handlePublish() {
    setPublishing(true);
    setError(null);
    const pub = await publishBatch(batch.id);
    setPublishing(false);
    if (!pub.ok) {
      setError(pub.error);
      return;
    }
    setResult(pub.result);
  }

  if (result) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
          <h2 className="text-lg font-semibold text-emerald-950">Published successfully</h2>
          <ul className="mt-3 space-y-1 text-sm text-emerald-900">
            <li>New exhibitors: {result.new_count}</li>
            <li>Tier updates: {result.tier_updated_count}</li>
            <li>Unchanged: {result.unchanged_count}</li>
            <li>Excluded from publish: {result.excluded_count}</li>
          </ul>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/events/editions/${editionId}?tab=exhibitors`}
            className={`${primaryCtaClass} h-10`}
          >
            Back to exhibitors
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Publish</h2>
        <p className="mt-1 text-sm text-slate-600">
          Publish draft exhibitors to the live event. This is additive — exhibitors already on the
          event are not removed.
        </p>
      </div>

      <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
        <li>Only draft links marked “Include” will be published.</li>
        <li>Higher exhibitor tier wins when the same company already exists live.</li>
        <li>Companies created during import are kept even if you discard future imports.</li>
      </ul>

      {loading ? (
        <ImportProgressMessage message={IMPORT_PROGRESS.loadingPublishSummary} />
      ) : diff ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm">
          <p className="font-medium text-slate-900">Ready to publish</p>
          <p className="mt-2 text-slate-700">
            {diff.new} new · {diff.tier_updated} tier updates · {diff.unchanged} unchanged ·{" "}
            {diff.excluded} excluded
          </p>
        </div>
      ) : null}

      {error ? <InlineErrorBanner message={error} /> : null}

      <div className="flex gap-2">
        <Button
          variant="secondary"
          onClick={() => goToStep("draft")}
          disabled={publishing}
        >
          Back
        </Button>
        <Button onClick={() => void handlePublish()} disabled={publishing || loading}>
          {publishing ? "Publishing to event…" : "Publish to event"}
        </Button>
      </div>
    </div>
  );
}
