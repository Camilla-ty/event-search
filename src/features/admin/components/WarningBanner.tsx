type WarningBannerProps = {
  messages: string[];
};

export function WarningBanner({ messages }: WarningBannerProps) {
  const filtered = messages.filter((m) => m.trim() !== "");
  if (filtered.length === 0) return null;

  return (
    <div
      role="status"
      className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
    >
      <p className="font-medium">Recommended before you continue</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {filtered.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </div>
  );
}
