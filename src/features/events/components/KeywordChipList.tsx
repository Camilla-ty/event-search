import Link from "next/link";

import { buildTopicHubPath } from "@/src/lib/routes/explorerUrls";

type KeywordChip = {
  id: string;
  name: string;
  slug?: string;
};

type KeywordChipListProps = {
  keywords: ReadonlyArray<KeywordChip>;
  variant?: "static" | "link";
  size?: "default" | "compact";
};

const defaultChipClass =
  "inline-block rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-sm text-slate-800";

const compactChipClass =
  "inline-block rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-800";

function chipClassForSize(size: "default" | "compact"): string {
  return size === "compact" ? compactChipClass : defaultChipClass;
}

export function KeywordChipList({
  keywords,
  variant = "static",
  size = "default",
}: KeywordChipListProps) {
  if (keywords.length === 0) return null;

  const chipClass = chipClassForSize(size);
  const linkChipClass = `${chipClass} transition hover:border-brand-primary hover:bg-brand-primary-muted`;
  const listGapClass = size === "compact" ? "gap-1.5" : "gap-2";

  return (
    <ul className={`flex flex-wrap ${listGapClass}`}>
      {keywords.map((keyword) => {
        const href =
          variant === "link" ? buildTopicHubPath(keyword.slug ?? "") : null;

        return (
          <li key={keyword.id}>
            {href ? (
              <Link href={href} className={linkChipClass}>
                {keyword.name}
              </Link>
            ) : (
              <span className={chipClass}>{keyword.name}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
