import { Button } from "@/src/components/common/Button";

type NoResultsStateProps = {
  title?: string;
  description?: string;
  onReset?: () => void;
  resetLabel?: string;
};

export function NoResultsState({
  title = "No results found",
  description = "Try broadening your filters or search terms.",
  onReset,
  resetLabel = "Reset filters",
}: NoResultsStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
      {onReset ? (
        <div className="mt-4">
          <Button variant="secondary" type="button" onClick={onReset}>
            {resetLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
