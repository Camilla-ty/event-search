import type { ReactNode } from "react";

import { PublicSponsorRosterRow } from "./PublicSponsorRosterRow";
import type { EventSponsorRow } from "./types";

export type PublicSponsorTierPanelProps = {
  /** Exact stored tier label; blank/null → "Untitled tier". */
  tierLabel: string | null;
  /** Count shown in the header (match count or full tier total, caller decides). */
  count: number;
  headerId: string;
  panelId: string;
  /**
   * When set, the header is an accordion toggle button.
   * When omitted, the header is static (search results).
   */
  interactive?: {
    expanded: boolean;
    onToggle: () => void;
    trailing?: ReactNode;
  };
  /** When false, the body region is not rendered. Defaults to true. */
  showBody?: boolean;
  /**
   * Body contents. Prefer this when the caller needs locked/loading/Load more
   * chrome. When omitted and `sponsors` is provided, renders the standard row list.
   */
  children?: ReactNode;
  /** Convenience: render standard roster rows when `children` is omitted. */
  sponsors?: EventSponsorRow[];
};

function resolveTierLabel(tierLabel: string | null): string {
  const trimmed = typeof tierLabel === "string" ? tierLabel.trim() : "";
  return trimmed !== "" ? trimmed : "Untitled tier";
}

export function publicSponsorTierPanelTitle(
  tierLabel: string | null,
  count: number,
): string {
  const label = resolveTierLabel(tierLabel);
  const safeCount = Math.max(0, Math.trunc(count));
  const sponsorWord = safeCount === 1 ? "sponsor" : "sponsors";
  return `${label} · ${safeCount} ${sponsorWord}`;
}

/**
 * Shared presentational chrome for a public sponsor tier block:
 * bordered card, header (exact label + count), and body/row list.
 * Accordion / lazy-load / lock / Load more stay in PublicSponsorTierSection.
 */
export function PublicSponsorTierPanel({
  tierLabel,
  count,
  headerId,
  panelId,
  interactive,
  showBody = true,
  children,
  sponsors,
}: PublicSponsorTierPanelProps) {
  const title = publicSponsorTierPanelTitle(tierLabel, count);
  const headerClassName =
    "flex min-h-12 w-full items-center justify-between gap-3 bg-slate-50 px-4 py-3 text-left text-sm font-semibold tracking-tight text-slate-800";

  const body =
    children !== undefined && children !== null ? (
      children
    ) : sponsors && sponsors.length > 0 ? (
      <ul>
        {sponsors.map((sponsor) => (
          <PublicSponsorRosterRow key={String(sponsor.id)} sponsor={sponsor} />
        ))}
      </ul>
    ) : null;

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <header>
        {interactive ? (
          <button
            type="button"
            id={headerId}
            aria-expanded={interactive.expanded}
            aria-controls={panelId}
            onClick={interactive.onToggle}
            className={`${headerClassName} transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary/40`}
          >
            <span>{title}</span>
            {interactive.trailing ? (
              <span className="flex shrink-0 items-center gap-2 text-slate-500">
                {interactive.trailing}
              </span>
            ) : null}
          </button>
        ) : (
          <div id={headerId} className={headerClassName}>
            <span>{title}</span>
          </div>
        )}
      </header>

      {showBody ? (
        <div
          id={panelId}
          role="region"
          aria-labelledby={headerId}
          className="border-t border-slate-200"
        >
          {body}
        </div>
      ) : null}
    </section>
  );
}
