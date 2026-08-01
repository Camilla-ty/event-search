"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { Badge, Button, InlineErrorBanner } from "@/src/components/common";
import { isEventBrandPublicProfileApproved } from "@/src/lib/companies/eventBrandPublicProfile";

type SameBrandSeriesSummary = {
  id: string;
  name: string;
  slug: string;
  lifecycle_status?: string | null;
};

type CompanyEventBrandPublicProfileSectionProps = {
  companyId: string;
  companyName: string;
  approvedAt: string | null;
  sameBrandSeries: SameBrandSeriesSummary | null;
  canEdit: boolean;
};

type ApiResponse = {
  ok: boolean;
  error?: string;
  company?: { event_brand_public_profile_approved_at: string | null };
};

function formatApprovedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);
}

export function CompanyEventBrandPublicProfileSection({
  companyId,
  companyName,
  approvedAt,
  sameBrandSeries,
  canEdit,
}: CompanyEventBrandPublicProfileSectionProps) {
  const router = useRouter();
  const isApproved = isEventBrandPublicProfileApproved(approvedAt);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  async function runAction(action: "approve" | "revoke") {
    setIsSubmitting(true);
    setResult(null);
    try {
      const response = await fetch(
        `/api/admin/companies/${companyId}/event-brand-public-profile/${action}`,
        { method: "POST" },
      );
      const data = (await response.json()) as ApiResponse;
      if (!response.ok || !data.ok) {
        setResult({
          ok: false,
          message: data.error ?? "Request failed.",
        });
        return;
      }
      setResult({
        ok: true,
        message:
          action === "approve"
            ? `${companyName} is approved to use its linked Event Series as the public profile (future routing).`
            : `Event Brand public-profile approval revoked for ${companyName}.`,
      });
      router.refresh();
    } catch {
      setResult({ ok: false, message: "Request failed." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mt-8 space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">
          Event Brand public profile
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Manual approval that the linked Event Series should become this company&apos;s{" "}
          <span className="font-medium text-slate-800">public profile destination</span> in
          future routing (ADR-005). This does{" "}
          <span className="font-medium text-slate-800">not</span> change Sponsor, Organizer,
          Exhibitor, or Partner Alumni data — those relationships stay on the Company row.
          Same-brand linking remains separate and is managed on the Event Series.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-600">Status:</span>
        {isApproved ? (
          <Badge variant="success">Approved</Badge>
        ) : (
          <Badge variant="neutral">Not approved</Badge>
        )}
        {isApproved && approvedAt ? (
          <span className="text-sm text-slate-500">
            since {formatApprovedAt(approvedAt)} UTC
          </span>
        ) : null}
      </div>

      {sameBrandSeries ? (
        <p className="text-sm text-slate-700">
          Linked Event Series:{" "}
          <Link
            href={`/admin/events/series/${sameBrandSeries.id}`}
            className="font-medium text-brand-primary hover:underline"
          >
            {sameBrandSeries.name}
          </Link>
        </p>
      ) : (
        <p className="text-sm text-amber-800">
          No same-brand Event Series is linked. Link one on the Event Series admin page before
          approving.
        </p>
      )}

      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          {isApproved ? (
            <Button
              type="button"
              variant="secondary"
              disabled={isSubmitting}
              onClick={() => void runAction("revoke")}
            >
              Revoke approval
            </Button>
          ) : (
            <Button
              type="button"
              disabled={isSubmitting || sameBrandSeries === null}
              onClick={() => void runAction("approve")}
            >
              Approve Event Series as public profile
            </Button>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-500">Read-only for merged companies.</p>
      )}

      {result ? (
        result.ok ? (
          <p className="text-sm text-green-700">{result.message}</p>
        ) : (
          <InlineErrorBanner message={result.message} />
        )
      ) : null}
    </section>
  );
}
