"use client";

import { Button } from "@/src/components/common/Button";
import { primaryCtaClass } from "@/src/lib/design/classes";

type ErrorStateProps = {
  title?: string;
  description?: string;
  onRetry?: () => void;
  homeHref?: string;
};

export function ErrorState({
  title = "Something went wrong",
  description = "We could not load this page. Please try again.",
  onRetry,
  homeHref = "/",
}: ErrorStateProps) {
  return (
    <div className="rounded-xl border border-rose-200 bg-white p-8 text-center shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {onRetry ? (
          <Button type="button" onClick={onRetry}>
            Try again
          </Button>
        ) : null}
        <a href={homeHref} className={primaryCtaClass}>
          Go to Home
        </a>
      </div>
    </div>
  );
}
