import { Search } from "lucide-react";

type SearchSubmitIconButtonProps = {
  ariaLabel?: string;
};

export function SearchSubmitIconButton({
  ariaLabel = "Search",
}: SearchSubmitIconButtonProps) {
  return (
    <button
      type="submit"
      aria-label={ariaLabel}
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center border-l border-slate-200 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary/15"
    >
      <Search className="h-4 w-4" aria-hidden />
    </button>
  );
}
