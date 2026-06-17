import type { ReactNode } from "react";

type AdminCompanySearchMatchHintProps = {
  matchedAlias: string | null | undefined;
  className?: string;
};

export function AdminCompanySearchMatchHint({
  matchedAlias,
  className = "",
}: AdminCompanySearchMatchHintProps): ReactNode {
  const alias = matchedAlias?.trim() ?? "";
  if (alias === "") return null;

  return (
    <span className={`text-xs text-slate-500 ${className}`.trim()}>
      Matched alias: {alias}
    </span>
  );
}
