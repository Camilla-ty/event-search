import Link from "next/link";

export type PublicBreadcrumbItem = {
  label: string;
  href?: string;
};

type PublicBreadcrumbsProps = {
  items: PublicBreadcrumbItem[];
};

export function PublicBreadcrumbs({ items }: PublicBreadcrumbsProps) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="text-sm text-slate-600">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
              {index > 0 ? <span aria-hidden className="shrink-0 text-slate-400">/</span> : null}
              {isLast || item.href === undefined ? (
                <span
                  className={[
                    isLast ? "truncate font-medium text-slate-900" : undefined,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  title={isLast ? item.label : undefined}
                >
                  {item.label}
                </span>
              ) : (
                <Link href={item.href} className="shrink-0 text-brand-primary hover:underline">
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
