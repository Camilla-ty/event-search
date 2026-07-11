"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Badge, Button, InlineErrorBanner } from "@/src/components/common";
import { formInputClass } from "@/src/lib/design/classes";

type CompanyPublicVisibilitySectionProps = {
  companyId: string;
  companyName: string;
  restrictedAt: string | null;
  canRestrict: boolean;
};

type VisibilityAction = "restrict" | "unrestrict";

type VisibilityApiResponse = {
  ok: boolean;
  error?: string;
  company?: { restricted_at: string | null };
};

function formatRestrictedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);
}

export function CompanyPublicVisibilitySection({
  companyId,
  companyName,
  restrictedAt,
  canRestrict,
}: CompanyPublicVisibilitySectionProps) {
  const router = useRouter();
  const isRestricted = restrictedAt !== null;
  const [pendingAction, setPendingAction] = useState<VisibilityAction | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    message: string;
    variant: "success" | "error";
  } | null>(null);

  function openConfirm(action: VisibilityAction) {
    setPendingAction(action);
    setAcknowledged(false);
    setResult(null);
  }

  function closeConfirm() {
    if (isSubmitting) return;
    setPendingAction(null);
    setAcknowledged(false);
  }

  async function confirmVisibilityAction() {
    if (!pendingAction) return;

    setIsSubmitting(true);
    setResult(null);

    try {
      const response = await fetch(
        `/api/admin/companies/${companyId}/${pendingAction}`,
        { method: "POST" },
      );
      const data = (await response.json()) as VisibilityApiResponse;

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
          pendingAction === "restrict"
            ? `${companyName} is now restricted from public display.`
            : `${companyName} public visibility restored.`,
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

  const actionLabel = pendingAction === "restrict" ? "Restrict" : "Restore";
  const actionDescription =
    pendingAction === "restrict"
      ? "This company will be removed from sponsor discovery and its public profile will return 404. Event sponsor lists will show the company name with a content-policy message only."
      : "This company will appear in sponsor discovery again and its public profile will be available.";

  return (
    <section className="mt-8 space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Public Visibility</h2>
        <p className="mt-1 text-sm text-slate-600">
          Control whether this company is publicly promoted on EventPixels.
        </p>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-[8rem_1fr]">
        <dt className="font-medium text-slate-700">Status</dt>
        <dd>
          <Badge variant="neutral">{isRestricted ? "Restricted" : "Public"}</Badge>
        </dd>
        {isRestricted ? (
          <>
            <dt className="font-medium text-slate-700">Restricted at</dt>
            <dd className="text-slate-600">{formatRestrictedAt(restrictedAt)}</dd>
          </>
        ) : null}
      </dl>

      {result ? (
        <InlineErrorBanner message={result.message} variant={result.variant} />
      ) : null}

      {canRestrict ? (
        <div className="flex flex-wrap gap-2">
          {isRestricted ? (
            <Button type="button" variant="secondary" onClick={() => openConfirm("unrestrict")}>
              Restore Public Visibility
            </Button>
          ) : (
            <Button
              type="button"
              className="!bg-red-600 hover:!bg-red-700 focus-visible:!ring-red-300"
              onClick={() => openConfirm("restrict")}
            >
              Restrict Company
            </Button>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-500">Merged companies cannot be restricted.</p>
      )}

      {pendingAction ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="company-visibility-title"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
            <h3 id="company-visibility-title" className="text-lg font-semibold text-slate-900">
              Confirm {actionLabel.toLowerCase()}
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              <span className="font-medium text-slate-900">{companyName}</span> — {actionDescription}
            </p>
            <label className="mt-4 flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
                disabled={isSubmitting}
                className={formInputClass}
              />
              <span>I understand this visibility change.</span>
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={closeConfirm} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!acknowledged || isSubmitting}
                className={
                  pendingAction === "restrict"
                    ? "!bg-red-600 hover:!bg-red-700 focus-visible:!ring-red-300"
                    : undefined
                }
                onClick={confirmVisibilityAction}
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
