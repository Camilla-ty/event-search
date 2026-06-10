type SeriesKeywordChip = {
  id: string;
  name: string;
};

type SeriesKeywordsChipsProps = {
  keywords: SeriesKeywordChip[];
};

export function SeriesKeywordsChips({ keywords }: SeriesKeywordsChipsProps) {
  if (keywords.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-2">
      {keywords.map((keyword) => (
        <li
          key={keyword.id}
          className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-sm text-slate-800"
        >
          {keyword.name}
        </li>
      ))}
    </ul>
  );
}
