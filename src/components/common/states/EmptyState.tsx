import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/src/components/common/Button";
import { secondaryCtaClass } from "@/src/lib/design/classes";

type EmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
  children?: ReactNode;
};

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
  children,
}: EmptyStateProps) {
  const action =
    actionLabel && actionHref ? (
      <Link href={actionHref} className={`${secondaryCtaClass} h-10 px-4`}>
        {actionLabel}
      </Link>
    ) : actionLabel && onAction ? (
      <Button variant="secondary" type="button" onClick={onAction}>
        {actionLabel}
      </Button>
    ) : null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
      {children ? <div className="mt-4">{children}</div> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
