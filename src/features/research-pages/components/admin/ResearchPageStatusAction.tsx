"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  canPublishResearchPage,
  YEAR_SCOPED_PUBLISH_BLOCKED_MESSAGE,
} from "@/src/features/research-pages/lib/researchPagePublishGuard";

type ResearchPageStatusActionProps = {
  pageId: string;
  currentStatus: "draft" | "published";
  /** null = All years. Year-scoped drafts cannot be published until Phase B. */
  year: number | null;
};

export function ResearchPageStatusAction({
  pageId,
  currentStatus,
  year,
}: ResearchPageStatusActionProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const publishBlocked =
    currentStatus === "draft" && !canPublishResearchPage(year);

  if (publishBlocked) {
    return (
      <span
        className="max-w-xs text-xs text-slate-500"
        title={YEAR_SCOPED_PUBLISH_BLOCKED_MESSAGE}
      >
        {YEAR_SCOPED_PUBLISH_BLOCKED_MESSAGE}
      </span>
    );
  }

  const targetAction = currentStatus === "draft" ? "publish" : "unpublish";
  const label = currentStatus === "draft" ? "Publish" : "Unpublish";

  async function handleClick() {
    if (
      targetAction === "unpublish" &&
      !window.confirm("Unpublish this page? It will no longer be publicly accessible.")
    ) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/research-pages/${pageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: targetAction }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? "Failed to update status.");
        return;
      }
      router.refresh();
    } catch {
      alert("Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={`text-sm font-medium hover:underline disabled:opacity-50 ${
        currentStatus === "draft"
          ? "text-green-700"
          : "text-red-700"
      }`}
    >
      {loading ? "…" : label}
    </button>
  );
}
