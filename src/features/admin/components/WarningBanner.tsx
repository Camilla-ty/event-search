import type { ReactNode } from "react";

type WarningBannerProps = {
  messages: string[];
  title?: string;
  action?: ReactNode;
};

export function WarningBanner({
  messages,
  title = "Recommended before you continue",
  action,
}: WarningBannerProps) {
  const filtered = messages.filter((m) => m.trim() !== "");
  if (filtered.length === 0) return null;

  return (
    <div
      role="status"
      className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
    >
      <p className="font-medium">{title}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {filtered.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
