import type { KeywordRow } from "@/src/features/events/types/keywords";

type EditionInheritedKeywordsProps = {
  seriesName: string | null;
  keywords: KeywordRow[];
};

export function EditionInheritedKeywords({
  seriesName,
  keywords,
}: EditionInheritedKeywordsProps) {
  const label = seriesName?.trim() || "parent series";

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
      <h3 className="text-sm font-semibold text-slate-900">Keywords (from series)</h3>
      <p className="mt-1 text-xs text-slate-600">
        Inherited from {label}. Edit keywords on the event series profile.
      </p>
      {keywords.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No keywords assigned to this series yet.</p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2">
          {keywords.map((keyword) => (
            <li
              key={keyword.id}
              className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-sm text-slate-800"
            >
              {keyword.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
