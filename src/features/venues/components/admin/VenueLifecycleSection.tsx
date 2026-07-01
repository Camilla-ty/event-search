"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button, InlineErrorBanner } from "@/src/components/common";
import { formInputClass } from "@/src/lib/design/classes";

type VenueLifecycleSectionProps = {
  venueId: string;
  venueName: string;
  isArchived: boolean;
};

type LifecycleAction = "archive" | "unarchive";

type LifecycleApiResponse = {
  ok: boolean;
  error?: string;
  venue?: { archived_at: string | null };
};

export function VenueLifecycleSection({
  venueId,
  venueName,
  isArchived,
}: VenueLifecycleSectionProps) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<LifecycleAction | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    message: string;
    variant: "success" | "error";
  } | null>(null);

  function openConfirm(action: LifecycleAction) {
    setPendingAction(action);
    setAcknowledged(false);
    setResult(null);
  }

  function closeConfirm() {
    if (isSubmitting) return;
    setPendingAction(null);
    setAcknowledged(false);
  }

  async function confirmLifecycleAction() {
    if (!pendingAction) return;

    setIsSubmitting(true);
    setResult(null);

    try {
      const response = await fetch(
        `/api/admin/venues/${venueId}/${pendingAction}`,
        { method: "POST" },
      );
      const data = (await response.json()) as LifecycleApiResponse;

      if (!response.ok || !data.ok) {
        setResult({
          ok: false,
          message: data.error ?? "Request failed.",
          variant: "error",
        });
        return;
      }

      setPendingAction(null);
      setAcknowledged(false);
      setResult({
        ok: true,
        message:
          pendingAction === "archive"
            ? `${venueName} archived.`
            : `${venueName} unarchived.`,
        variant: "success",
      });
      router.refresh();
    } catch {
      setResult({
        ok: false,
        message: "Request failed.",
        variant: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const actionLabel = pendingAction === "archive" ? "Archive" : "Unarchive";
  const actionDescription =
    pendingAction === "archive"
      ? "Archived venues are hidden from the default list and edition pickers. Linked editions keep their venue reference."
      : "Unarchiving restores this venue to active lists and pickers.";

  return (
    <section className="mt-8 space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Lifecycle</h2>
        <p className="mt-1 text-sm text-slate-600">
          Venues are archived instead of deleted. Use unarchive to restore an archived venue.
        </p>
      </div>

      {result ? (
        <InlineErrorBanner message={result.message} variant={result.variant} />
      ) : null}

      <div className="flex flex-wrap gap-2">
        {isArchived ? (
          <Button type="button" variant="secondary" onClick={() => openConfirm("unarchive")}>
            Unarchive venue
          </Button>
        ) : (
          <Button
            type="button"
            className="!bg-red-600 hover:!bg-red-700 focus-visible:!ring-red-300"
            onClick={() => openConfirm("archive")}
          >
            Archive venue
          </Button>
        )}
      </div>

      {pendingAction ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="venue-lifecycle-title"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
            <h3 id="venue-lifecycle-title" className="text-lg font-semibold text-slate-900">
              Confirm {actionLabel.toLowerCase()}
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              <span className="font-medium text-slate-900">{venueName}</span> — {actionDescription}
            </p>
            <label className="mt-4 flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
                disabled={isSubmitting}
                className={formInputClass}
              />
              <span>I understand this lifecycle change.</span>
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={closeConfirm} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!acknowledged || isSubmitting}
                className={
                  pendingAction === "archive"
                    ? "!bg-red-600 hover:!bg-red-700 focus-visible:!ring-red-300"
                    : undefined
                }
                onClick={confirmLifecycleAction}
              >
                {isSubmitting ? `${actionLabel}…` : actionLabel}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
