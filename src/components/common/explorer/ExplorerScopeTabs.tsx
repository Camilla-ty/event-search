export type ExplorerSearchScope = "events" | "sponsors";

type ExplorerScopeTabsProps = {
  scope: ExplorerSearchScope;
  onScopeChange: (scope: ExplorerSearchScope) => void;
};

export function ExplorerScopeTabs({ scope, onScopeChange }: ExplorerScopeTabsProps) {
  return (
    <div
      className="flex shrink-0 items-center border-r border-slate-200 bg-slate-50 p-0.5"
      role="tablist"
      aria-label="Search scope"
    >
      <button
        type="button"
        role="tab"
        aria-selected={scope === "events"}
        onClick={() => onScopeChange("events")}
        className={[
          "rounded-md px-3 py-1.5 text-xs font-medium transition",
          scope === "events"
            ? "bg-brand-primary text-white shadow-sm"
            : "text-slate-600 hover:text-slate-900",
        ].join(" ")}
      >
        Events
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={scope === "sponsors"}
        onClick={() => onScopeChange("sponsors")}
        className={[
          "rounded-md px-3 py-1.5 text-xs font-medium transition",
          scope === "sponsors"
            ? "bg-brand-primary text-white shadow-sm"
            : "text-slate-600 hover:text-slate-900",
        ].join(" ")}
      >
        Sponsors
      </button>
    </div>
  );
}
