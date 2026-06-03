export function AuthIntentRedirectOverlay({
  message,
  statusLine,
}: {
  message: string;
  statusLine: string;
}) {
  return (
    <div
      className="flex min-h-[12rem] flex-col items-center justify-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-8 text-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <p className="text-sm font-medium text-slate-700">{message}</p>
      <p className="text-sm text-slate-600">{statusLine}</p>
    </div>
  );
}
