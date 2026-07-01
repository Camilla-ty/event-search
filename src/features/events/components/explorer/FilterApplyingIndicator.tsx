type FilterApplyingIndicatorProps = {
  visible: boolean;
};

export function FilterApplyingIndicator({ visible }: FilterApplyingIndicatorProps) {
  if (!visible) return null;

  return (
    <p className="text-sm text-slate-500" role="status" aria-live="polite">
      Applying filters…
    </p>
  );
}
