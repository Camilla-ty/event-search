"use client";

import { ErrorState } from "@/src/components/common/states";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-page px-4 py-12">
      <div className="w-full max-w-md">
        <ErrorState
          description={error.message || "An unexpected error occurred."}
          onRetry={reset}
        />
      </div>
    </div>
  );
}
