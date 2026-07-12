"use client";

type AdminVenuesIncludeArchivedToggleProps = {
  includeArchived: boolean;
  onToggle: () => void;
};

export function AdminVenuesIncludeArchivedToggle({
  includeArchived,
  onToggle,
}: AdminVenuesIncludeArchivedToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={includeArchived}
      onClick={onToggle}
      className={
        includeArchived
          ? "rounded-full bg-brand-primary px-3 py-1.5 text-sm font-medium text-white"
          : "rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
      }
    >
      {includeArchived ? "Showing archived" : "Show archived"}
    </button>
  );
}
