"use client";

import { useRouter } from "next/navigation";

import { feedbackSuccessClass } from "@/src/lib/design/classes";

type CompanyMergeSuccessBannerProps = {
  mergeId: string;
};

export function CompanyMergeSuccessBanner({ mergeId }: CompanyMergeSuccessBannerProps) {
  const router = useRouter();

  function dismiss() {
    router.replace(window.location.pathname);
  }

  return (
    <div
      role="status"
      className={`${feedbackSuccessClass} mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}
    >
      <p>
        Companies merged successfully. Merge record{" "}
        <span className="font-mono text-xs">{mergeId}</span>.
      </p>
      <button
        type="button"
        className="shrink-0 text-sm font-medium text-brand-success hover:underline"
        onClick={dismiss}
      >
        Dismiss
      </button>
    </div>
  );
}
