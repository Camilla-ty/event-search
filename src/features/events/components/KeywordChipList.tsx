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
};

const staticChipClass =
  "inline-block rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-sm text-slate-800";

const linkChipClass = `${staticChipClass} transition hover:border-brand-primary hover:bg-brand-primary-muted`;

export function KeywordChipList({
  keywords,
  variant = "static",
}: KeywordChipListProps) {
  if (keywords.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-2">
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
              <span className={staticChipClass}>{keyword.name}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
