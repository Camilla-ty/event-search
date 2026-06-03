"use client";

export function AuthIntentRedirectOverlay({
  message,
  statusLine,
}: {
  message: string;
  statusLine: string;
}) {
  return (
    <div
      className="flex min-h-[12rem] flex-col items-center justify-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-8 text-center dark:border-slate-700 dark:bg-slate-950/50"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{message}</p>
      <p className="text-sm text-slate-600 dark:text-slate-300">{statusLine}</p>
    </div>
  );
}
