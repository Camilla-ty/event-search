"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button, InlineErrorBanner } from "@/src/components/common";
import { formInputClass } from "@/src/lib/design/classes";

import { acknowledgeReview, fetchDraftLinks, patchDraftLink } from "../../client/api";
import { flowHref } from "../../client/resumeStep";
import type { DraftDiffSummary, DraftLinkRow, SponsorImportBatch } from "../../client/types";
import { IMPORT_PROGRESS } from "../../importProgress";
import { useImportProgressLabel } from "../ImportFlowProgress";
import { ImportProgressMessage } from "../ImportProgressMessage";

type DraftReviewStepProps = {
  batch: SponsorImportBatch;
};

export function DraftReviewStep({ batch }: DraftReviewStepProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [links, setLinks] = useState<DraftLinkRow[]>([]);
  const [diff, setDiff] = useState<DraftDiffSummary>({
    new: 0,
    tier_updated: 0,
    unchanged: 0,
    excluded: 0,
  });
  const [acknowledged, setAcknowledged] = useState(false);

  useImportProgressLabel(loading, IMPORT_PROGRESS.loadingDraft);

  async function reload() {
    const result = await fetchDraftLinks(batch.id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setLinks(result.links);
    setDiff(result.diff);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      await reload();
      if (!cancelled) setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [batch.id]);

  async function updateTier(link: DraftLinkRow, tier: number) {
    const result = await patchDraftLink(batch.id, link.id, { tier_rank: tier });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await reload();
  }

  async function toggleExclude(link: DraftLinkRow) {
    const result = await patchDraftLink(batch.id, link.id, {
      excluded_from_publish: !link.excluded_from_publish,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await reload();
  }

  async function handleContinue() {
    if (!acknowledged) return;
    setSubmitting(true);
    setError(null);
    const result = await acknowledgeReview(batch.id);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(flowHref(batch.id, "publish"));
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Draft review</h2>
        <p className="mt-1 text-sm text-slate-600">
          Review draft sponsor links before publishing. Publishing is additive — existing live
          sponsors stay unchanged.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <span className="rounded-md bg-emerald-50 px-3 py-1 text-emerald-950">
          New: {diff.new}
        </span>
        <span className="rounded-md bg-amber-50 px-3 py-1 text-amber-950">
          Tier updated: {diff.tier_updated}
        </span>
        <span className="rounded-md bg-slate-100 px-3 py-1">Unchanged: {diff.unchanged}</span>
        <span className="rounded-md bg-slate-100 px-3 py-1">Excluded: {diff.excluded}</span>
      </div>

      {loading ? (
        <ImportProgressMessage message={IMPORT_PROGRESS.loadingDraft} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Company</th>
                <th className="px-4 py-2">Domain</th>
                <th className="px-4 py-2">Tier</th>
                <th className="px-4 py-2">Label</th>
                <th className="px-4 py-2">Publish</th>
              </tr>
            </thead>
            <tbody>
              {links.map((link) => (
                <tr
                  key={link.id}
                  className={[
                    "border-b border-slate-100",
                    link.excluded_from_publish ? "opacity-50" : "",
                  ].join(" ")}
                >
                  <td className="px-4 py-2">{link.companies?.name ?? link.company_id}</td>
                  <td className="px-4 py-2">{link.companies?.domain ?? "—"}</td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min={1}
                      className={`${formInputClass} w-20`}
                      value={link.tier_rank}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (Number.isInteger(n) && n >= 1) void updateTier(link, n);
                      }}
                    />
                  </td>
                  <td className="px-4 py-2">{link.tier_label ?? "—"}</td>
                  <td className="px-4 py-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!link.excluded_from_publish}
                        onChange={() => void toggleExclude(link)}
                      />
                      Include
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="mt-1"
        />
        <span>
          I have reviewed the draft sponsor list and understand publish will add or update
          sponsors on this edition without removing existing live sponsors.
        </span>
      </label>

      {error ? <InlineErrorBanner message={error} /> : null}

      <div className="flex gap-2">
        <Button
          variant="secondary"
          onClick={() => router.push(flowHref(batch.id, "review"))}
          disabled={submitting}
        >
          Back
        </Button>
        <Button onClick={() => void handleContinue()} disabled={!acknowledged || submitting}>
          {submitting ? "Saving…" : "Continue to publish →"}
        </Button>
      </div>
    </div>
  );
}
